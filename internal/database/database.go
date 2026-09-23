package database

import (
	"log"

	"github.com/buka/fooddelivery/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(url string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}
	DB = db
	return db, nil
}

// Migrate creates/updates the schema. Run at startup so a fresh DB works
// out of the box; seed then repopulates.
func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&models.Restaurant{},
		&models.MenuItem{},
		&models.Customer{},
		&models.Order{},
		&models.OrderItem{},
	); err != nil {
		return err
	}
	log.Println("database migration complete")
	return nil
}