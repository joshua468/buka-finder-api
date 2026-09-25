package models

import (
	"time"

	"github.com/shopspring/decimal"
)

const (
	RestaurantActive   = "active"
	RestaurantInactive = "inactive"
	RestaurantSuspended = "suspended"

	CustomerActive   = "active"
	CustomerInactive = "inactive"
	CustomerSuspended = "suspended"

	OrderPending        = "pending"
	OrderConfirmed      = "confirmed"
	OrderPreparing      = "preparing"
	OrderReady          = "ready"
	OrderOutForDelivery = "out_for_delivery"
	OrderDelivered      = "delivered"
	OrderCancelled      = "cancelled"
)

type Restaurant struct {
	ID          string          `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string          `gorm:"type:varchar(255);uniqueIndex;not null" json:"name"`
	Description string          `gorm:"type:text" json:"description,omitempty"`
	CuisineType string          `gorm:"type:varchar(100)" json:"cuisine_type,omitempty"`
	Address     string          `gorm:"type:varchar(500);not null" json:"address"`
	City        string          `gorm:"type:varchar(100);not null;index" json:"city"`
	Rating      decimal.Decimal `gorm:"type:numeric(4,3);default:0.0" json:"rating"`
	Status      string          `gorm:"type:varchar(20);default:active;index" json:"status"`
	Phone       string          `gorm:"type:varchar(20);uniqueIndex" json:"phone,omitempty"`
	Email       string          `gorm:"type:varchar(255);uniqueIndex" json:"email,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`

	MenuItems []MenuItem `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

type MenuItem struct {
	ID                     string          `gorm:"type:uuid;primaryKey" json:"id"`
	RestaurantID           string          `gorm:"type:uuid;index:idx_menu_restaurant_available;not null" json:"restaurant_id"`
	Name                   string          `gorm:"type:varchar(255);not null" json:"name"`
	Description            string          `gorm:"type:text" json:"description,omitempty"`
	Price                  decimal.Decimal `gorm:"type:numeric(10,2);not null" json:"price"`
	Available              bool            `gorm:"default:true" json:"available"`
	Category               string          `gorm:"type:varchar(100);index" json:"category,omitempty"`
	PreparationTimeMinutes int             `gorm:"default:15" json:"preparation_time_minutes"`
	CreatedAt              time.Time       `json:"created_at"`
	UpdatedAt              time.Time       `json:"updated_at"`

	Restaurant Restaurant `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

type Customer struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	Email     string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Phone     string    `gorm:"type:varchar(20)" json:"phone,omitempty"`
	FirstName string    `gorm:"type:varchar(100)" json:"first_name,omitempty"`
	LastName  string    `gorm:"type:varchar(100)" json:"last_name,omitempty"`
	Address   string    `gorm:"type:varchar(500)" json:"address,omitempty"`
	City      string    `gorm:"type:varchar(100);index" json:"city,omitempty"`
	Status    string    `gorm:"type:varchar(20);default:active;index" json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Orders []Order `json:"-"`
}

type Order struct {
	ID                    string          `gorm:"type:uuid;primaryKey" json:"id"`
	CustomerID            string          `gorm:"type:uuid;index:idx_orders_customer_status;not null" json:"customer_id"`
	RestaurantID          string          `gorm:"type:uuid;not null" json:"restaurant_id"`
	Status                string          `gorm:"type:varchar(20);default:pending;index" json:"status"`
	TotalAmount           decimal.Decimal `gorm:"type:numeric(10,2);not null" json:"total_amount"`
	DeliveryAddress       string          `gorm:"type:varchar(500);not null" json:"delivery_address"`
	DeliveryCity          string          `gorm:"type:varchar(100);not null" json:"delivery_city"`
	EstimatedDeliveryTime *time.Time      `json:"estimated_delivery_time,omitempty"`
	DeliveredAt           *time.Time      `json:"delivered_at,omitempty"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`

	Customer Customer  `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"-"`
	Restaurant Restaurant `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"-"`
	Items     []OrderItem `gorm:"constraint:OnDelete:CASCADE;" json:"items,omitempty"`
}

type OrderItem struct {
	ID                  string          `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID             string          `gorm:"type:uuid;index;not null" json:"order_id"`
	MenuItemID          string          `gorm:"type:uuid;index;not null" json:"menu_item_id"`
	Quantity            int             `gorm:"not null" json:"quantity"`
	UnitPrice           decimal.Decimal `gorm:"type:numeric(10,2);not null" json:"unit_price"`
	Subtotal            decimal.Decimal `gorm:"type:numeric(10,2);not null" json:"subtotal"`
	SpecialInstructions string          `gorm:"type:text" json:"special_instructions,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`

	Order    Order    `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	MenuItem MenuItem `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"-"`
}