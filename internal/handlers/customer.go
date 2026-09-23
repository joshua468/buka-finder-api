package handlers

import (
	"errors"

	"github.com/buka/fooddelivery/internal/database"
	"github.com/buka/fooddelivery/internal/filters"
	"github.com/buka/fooddelivery/internal/models"
	"github.com/buka/fooddelivery/internal/paging"
	"github.com/buka/fooddelivery/internal/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var customerSorts = map[string]bool{
	"name":       true,
	"created_at": true,
}

var customerFilters = map[string]string{
	"city":   "city",
	"status": "status",
}

// ListCustomers GET /api/v1/customers
func ListCustomers(c *gin.Context) {
	q, ok := paging.Parse(c, customerSorts)
	if !ok {
		return
	}
	var total int64
	var items []models.Customer
	db := database.DB.Model(&models.Customer{})
	db = filters.New().Add(c, "city").Add(c, "status").Apply(db, customerFilters)
	db.Count(&total)

	db = db.Distinct().Limit(q.Limit).Offset(q.Offset)
	if q.OrderClause() != "" {
		db = db.Order(q.OrderClause())
	} else {
		db = db.Order("created_at DESC")
	}
	if err := db.Find(&items).Error; err != nil {
		response.Err(c, 500, response.CodeInternalError, "failed to list customers")
		return
	}
	response.List(c, 200, items, response.Meta{
		Total: int(total), Limit: q.Limit, Offset: q.Offset, HasMore: q.HasMore(int(total)),
	})
}

// GetCustomer GET /api/v1/customers/:id
func GetCustomer(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		response.Err(c, 400, response.CodeInvalidRequest, "invalid customer id: not a UUID")
		return
	}
	var cu models.Customer
	if err := database.DB.First(&cu, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Err(c, 404, response.CodeResourceNotFound, "customer not found")
			return
		}
		response.Err(c, 500, response.CodeInternalError, "failed to load customer")
		return
	}
	response.OK(c, 200, cu)
}