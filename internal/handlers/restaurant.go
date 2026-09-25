package handlers

import (
	"errors"
	"strings"

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

var restaurantSorts = map[string]bool{
	"name":       true,
	"rating":     true,
	"created_at": true,
}

// Match filters (IN semantics). rating_min is a range filter (>=) and lives in
// rangeFilters instead — IN would match only the exact rating.
var restaurantFilters = map[string]string{
	"city":    "city",
	"cuisine": "cuisine_type",
	"status":  "status",
}

var rangeFilters = map[string]string{
	"rating_min": "rating",
}

// ListRestaurants GET /api/v1/restaurants
func ListRestaurants(c *gin.Context) {
	q, ok := paging.Parse(c, restaurantSorts)
	if !ok {
		return
	}
	var total int64
	var items []models.Restaurant
	db := database.DB.Model(&models.Restaurant{})
	fb := filters.New().Add(c, "city").Add(c, "cuisine").Add(c, "status").Add(c, "rating_min")
	db = fb.Apply(db, restaurantFilters)
	db = fb.ApplyRange(db, rangeFilters)
	if q := strings.TrimSpace(c.Query("search")); q != "" {
		db = db.Where("name ILIKE ?", "%"+q+"%")
	}
	db.Count(&total)

	db = db.Distinct().Limit(q.Limit).Offset(q.Offset)
	if q.OrderClause() != "" {
		db = db.Order(q.OrderClause())
	} else {
		db = db.Order("created_at DESC")
	}
	if err := db.Find(&items).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to list restaurants")
		return
	}
	response.List(c, 200, items, response.Meta{
		Total: int(total), Limit: q.Limit, Offset: q.Offset, HasMore: q.HasMore(int(total)),
	})
}

// GetRestaurant GET /api/v1/restaurants/:id
func GetRestaurant(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "invalid restaurant id: not a UUID")
		return
	}
	var r models.Restaurant
	if err := database.DB.Preload("MenuItems").First(&r, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "restaurant not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load restaurant")
		return
	}
	response.OK(c, 200, r)
}

// ListRestaurantMenu GET /api/v1/restaurants/:id/menu
func ListRestaurantMenu(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "invalid restaurant id: not a UUID")
		return
	}
	var r models.Restaurant
	if err := database.DB.First(&r, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "restaurant not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load restaurant")
		return
	}

	q, ok := paging.Parse(c, map[string]bool{"name": true, "price": true, "category": true})
	if !ok {
		return
	}
	var total int64
	var items []models.MenuItem
	db := database.DB.Model(&models.MenuItem{}).Where("restaurant_id = ?", id)
	if cats := filters.Values(c, "category"); len(cats) > 0 {
		db = db.Where("category IN ?", cats)
	}
	if av := filters.Values(c, "available"); len(av) > 0 {
		db = db.Where("available = ?", strings.EqualFold(av[0], "true"))
	}
	for _, v := range filters.Values(c, "min_price") {
		if dv, err := decimal.NewFromString(v); err == nil {
			db = db.Where("price >= ?", dv)
		}
	}
	for _, v := range filters.Values(c, "max_price") {
		if dv, err := decimal.NewFromString(v); err == nil {
			db = db.Where("price <= ?", dv)
		}
	}
	db.Count(&total)

	db = db.Limit(q.Limit).Offset(q.Offset)
	if q.OrderClause() != "" {
		db = db.Order(q.OrderClause())
	} else {
		db = db.Order("name ASC")
	}
	if err := db.Find(&items).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to list menu items")
		return
	}
	if items == nil {
		items = []models.MenuItem{}
	}
	response.List(c, 200, items, response.Meta{
		Total: int(total), Limit: q.Limit, Offset: q.Offset, HasMore: q.HasMore(int(total)),
	})
}