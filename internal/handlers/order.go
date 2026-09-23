package handlers

import (
	"errors"
	"time"

	"github.com/buka/fooddelivery/internal/database"
	"github.com/buka/fooddelivery/internal/filters"
	"github.com/buka/fooddelivery/internal/models"
	"github.com/buka/fooddelivery/internal/paging"
	"github.com/buka/fooddelivery/internal/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var orderSorts = map[string]bool{
	"created_at":   true,
	"total_amount": true,
	"status":       true,
}

// ListOrders GET /api/v1/orders
func ListOrders(c *gin.Context) {
	q, ok := paging.Parse(c, orderSorts)
	if !ok {
		return
	}
	var total int64
	var items []models.Order
	db := database.DB.Model(&models.Order{})
	db = buildOrderFilters(c, db)
	db.Count(&total)

	db = db.Distinct().Preload("Items").Limit(q.Limit).Offset(q.Offset)
	if q.OrderClause() != "" {
		db = db.Order(q.OrderClause())
	} else {
		db = db.Order("created_at DESC")
	}
	if err := db.Find(&items).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to list orders")
		return
	}
	response.List(c, 200, items, response.Meta{
		Total: int(total), Limit: q.Limit, Offset: q.Offset, HasMore: q.HasMore(int(total)),
	})
}

// GetOrder GET /api/v1/orders/:id
func GetOrder(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "invalid order id: not a UUID")
		return
	}
	var o models.Order
	if err := database.DB.Preload("Items").First(&o, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "order not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load order")
		return
	}
	response.OK(c, 200, o)
}

// CreateOrder POST /api/v1/orders
// Business rules: customer exists; restaurant active; all items from the one
// restaurant; items available; total = sum(items); delivery address required.
func CreateOrder(c *gin.Context) {
	var req struct {
		CustomerID      string `json:"customer_id" binding:"required"`
		RestaurantID    string `json:"restaurant_id" binding:"required"`
		DeliveryAddress string `json:"delivery_address" binding:"required"`
		DeliveryCity    string `json:"delivery_city"`
		Items           []struct {
			MenuItemID string `json:"menu_item_id" binding:"required"`
			Quantity   int    `json:"quantity" binding:"required,min=1"`
		} `json:"items" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, 422, response.CodeValidationError, err.Error())
		return
	}
	if _, err := uuid.Parse(req.CustomerID); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "customer_id must be a UUID")
		return
	}
	if _, err := uuid.Parse(req.RestaurantID); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "restaurant_id must be a UUID")
		return
	}

	var customer models.Customer
	if err := database.DB.First(&customer, "id = ?", req.CustomerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "customer not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load customer")
		return
	}

	var restaurant models.Restaurant
	if err := database.DB.First(&restaurant, "id = ?", req.RestaurantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "restaurant not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load restaurant")
		return
	}
	if restaurant.Status != models.RestaurantActive {
		response.Err(c, 409, response.CodeConflict, "restaurant is not accepting orders (status: "+restaurant.Status+")")
		return
	}

	ids := make([]string, 0, len(req.Items))
	qty := map[string]int{}
	for _, it := range req.Items {
		if _, err := uuid.Parse(it.MenuItemID); err != nil {
			response.Err(c, 400, response.CodeInvalidRequest, "menu_item_id must be a UUID")
			return
		}
		ids = append(ids, it.MenuItemID)
		qty[it.MenuItemID] += it.Quantity
	}

	var items []models.MenuItem
	if err := database.DB.Find(&items, "id IN ?", ids).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to load menu items")
		return
	}
	if len(items) != len(ids) {
		response.Err(c, 404, response.CodeResourceNotFound, "one or more menu items not found")
		return
	}
	// all items must belong to the order's restaurant
	orderedIDs := map[string]bool{}
	for _, it := range items {
		orderedIDs[it.ID] = true
	}
	if hasOther := itemFromOtherRestaurant(items, req.RestaurantID); hasOther != nil {
		response.Err(c, 409, response.CodeConflict, "menu item "+hasOther.ID+" does not belong to this restaurant")
		return
	}
	for _, it := range items {
		if !it.Available {
			response.Err(c, 409, response.CodeConflict, "menu item "+it.Name+" is not available")
			return
		}
	}

	total := decimal.Zero
	now := time.Now()
	order := models.Order{
		ID:              uuid.NewString(),
		CustomerID:      req.CustomerID,
		RestaurantID:    req.RestaurantID,
		Status:          models.OrderPending,
		DeliveryAddress: req.DeliveryAddress,
		DeliveryCity:    req.DeliveryCity,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if order.DeliveryCity == "" {
		order.DeliveryCity = restaurant.City
	}
	for _, it := range items {
		subtotal := it.Price.Mul(decimal.NewFromInt(int64(qty[it.ID])))
		total = total.Add(subtotal)
		order.Items = append(order.Items, models.OrderItem{
			ID:         uuid.NewString(),
			OrderID:    order.ID,
			MenuItemID: it.ID,
			Quantity:   qty[it.ID],
			UnitPrice:  it.Price,
			Subtotal:   subtotal,
			CreatedAt:  now,
		})
	}
	order.TotalAmount = total

	// Transaction: insert order + items atomically.
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Items").Create(&order).Error; err != nil {
			return err
		}
		for i := range order.Items {
			order.Items[i].OrderID = order.ID
		}
		return tx.Create(&order.Items).Error
	})
	if err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to create order")
		return
	}

	// Return the order with its items preloaded.
	if err := database.DB.Preload("Items").First(&order, "id = ?", order.ID).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to load created order")
		return
	}
	response.OK(c, 201, order)
}

// itemFromOtherRestaurant returns the first item that isn't from the given
// restaurant, or nil if all belong.
func itemFromOtherRestaurant(items []models.MenuItem, restaurantID string) *models.MenuItem {
	for i := range items {
		if items[i].RestaurantID != restaurantID {
			return &items[i]
		}
	}
	return nil
}

// UpdateOrder PATCH /api/v1/orders/:id — status transitions only (cancellable,
// never create from delivered). Keeps updated_at fresh on change.
func UpdateOrder(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "invalid order id: not a UUID")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, 400, response.CodeInvalidQuery, "invalid JSON body")
		return
	}
	var o models.Order
	if err := database.DB.First(&o, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "order not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load order")
		return
	}
	if !validTransition(o.Status, req.Status) {
		response.Err(c, 409, response.CodeConflict,
			"cannot transition order from "+o.Status+" to "+req.Status)
		return
	}
	now := time.Now()
	o.Status = req.Status
	o.UpdatedAt = now
	if req.Status == models.OrderDelivered {
		o.DeliveredAt = &now
	}
	if err := database.DB.Save(&o).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to update order")
		return
	}
	if err := database.DB.Preload("Items").First(&o, "id = ?", id).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to reload order")
		return
	}
	response.OK(c, 200, o)
}

// DeleteOrder DELETE /api/v1/orders/:id — hard delete with cascade.
func DeleteOrder(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "invalid order id: not a UUID")
		return
	}
	res := database.DB.Where("id = ?", id).Delete(&models.Order{})
	if res.Error != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to delete order")
		return
	}
	if res.RowsAffected == 0 {
		response.Err(c, 404, response.CodeResourceNotFound, "order not found")
		return
	}
	response.OK(c, 200, gin.H{"deleted": id})
}

func buildOrderFilters(c *gin.Context, db *gorm.DB) *gorm.DB {
	if vals := filters.Values(c, "status"); len(vals) > 0 {
		db = db.Where("status IN ?", vals)
	}
	if vals := validUUIDs(filters.Values(c, "restaurant_id")); len(vals) > 0 {
		db = db.Where("restaurant_id IN ?", vals)
	}
	if vals := validUUIDs(filters.Values(c, "customer_id")); len(vals) > 0 {
		db = db.Where("customer_id IN ?", vals)
	}
	return db
}

// validUUIDs drops values that aren't well-formed UUIDs. Invalid ids are
// ignored (never error) so a bogus ?customer_id can't 500 or 400 a list.
func validUUIDs(vals []string) []string {
	out := make([]string, 0, len(vals))
	for _, v := range vals {
		if _, err := uuid.Parse(v); err == nil {
			out = append(out, v)
		}
	}
	return out
}

// validTransition implements AGENTS.md order status machine:
// pending -> confirmed -> preparing -> ready -> out_for_delivery -> delivered
// cancellable from any state except delivered.
func validTransition(from, to string) bool {
	if to == "" {
		return false
	}
	if to == models.OrderCancelled {
		return from != models.OrderDelivered
	}
	next := map[string]string{
		models.OrderPending:        models.OrderConfirmed,
		models.OrderConfirmed:      models.OrderPreparing,
		models.OrderPreparing:      models.OrderReady,
		models.OrderReady:          models.OrderOutForDelivery,
		models.OrderOutForDelivery: models.OrderDelivered,
	}
	return next[from] == to
}