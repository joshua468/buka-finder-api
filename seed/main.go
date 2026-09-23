package main

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/buka/fooddelivery/internal/config"
	"github.com/buka/fooddelivery/internal/database"
	"github.com/buka/fooddelivery/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Seed: deterministic, repeatable, idempotent. Clears all rows (TRUNCATE)
// then inserts the same data every run. Same seed value -> same data.

const (
	nRestaurants = 350
	nCustomers   = 320
	nMenuPerRest = 10 // 10 items per restaurant => 3,500 items
	nOrders      = 2100
	nOrderItems  = 4 // avg items per order
	seed         = 20240601
)

var (
	cities = []string{"Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City"}
	areas  = []string{"Victoria Island", "Gwarinpa", "Yenagoa Rd", "Ring Road", "Garki", "New Haven", "Airport Rd"}
	cuisines = []string{"Nigerian", "Yoruba", "Igbo", "Hausa", "Continental", "Fast Food", "Seafood", "Barbecue"}
	// curated Nigerian names so output reads like a real local platform
	restNames  = []string{"Chop & Cheers", "Mama Put Kitchen", "Kilishi Spot", "Suya Republic", "Ofada Rice House", "Jollof Junction", "Ewa Agoyin Palace", "Nasco Eatery", "Iya Metro Soup", "Buka Palace", "Naija Flavour", "Pepper Soup Inn", "Akara House", "Moi Moi Spot", "Efo Riro Place", "Puff-Puff Yard", "Amala & Gbegiri", "Banga Soup Buka", "Edikang Ikong", "Groundnut Soup Hub", "Ogbono Health Foods", "White Soup Kitchen", "Nkwobi Lounge", "Isi Ewu Corner", "Asun Republic", "Beans & Plantain", "Yam Pottage Spot", "Nigerian Grill House", "Semo Specialist", "Pounded Yam Palace", "Egusi Supreme", "Okra Soup Joint"}
	itemNames  = []string{"Jollof Rice with Chicken", "Fried Rice", "Ofada Rice with Ayamase", "Efo Riro", "Egusi Soup", "Ogbono Soup", "Pounded Yam", "Amala with Gbegiri", "Suya Skewers", "Kilishi", "Nkwobi", "Asun", "Moi Moi", "Akara", "Pepper Soup", "Peppered Snail", "Banga Soup", "Edikang Ikong", "White Soup", "Grilled Catfish", "Plantain Mosa", "Puff Puff", "Chin Chin", "Zobo Drink", "Chapman", "Kunun Aya", "Groundnut Soup", "Vegetable Soup", "Okro Soup", "Boli (Roast Plantain)"}
	catNames  = []string{"Adaeze", "Chiamaka", "Chidi", "Emeka", "Ngozi", "Obinna", "Amina", "Fatima", "Ibrahim", "Musa", "Yetunde", "Tunde", "Funke", "Kelechi", "Ifeoma", "Uche", "Oluwatobi", "Sade", "Temi", "Kunle", "Zainab", "Halima", "Adaobi", "Ebere", "Nnamdi", "Chinedu", "Amara", "Somto", "Chinwe", "Obi", "Adeola", "Bisi"}
	statuses   = []string{models.RestaurantActive, models.RestaurantInactive, models.RestaurantSuspended}
)

func main() {
	cfg := config.Load()
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	rng := rand.New(rand.NewSource(seed))

	if err := reset(db); err != nil {
		log.Fatalf("reset: %v", err)
	}

	restaurants := seedRestaurants(rng, db)
	menu := seedMenu(rng, db, restaurants)
	customers := seedCustomers(rng, db)
	seedOrders(rng, db, restaurants, customers, menu)

	fmt.Printf("seeded %d restaurants, %d menu items, %d customers, %d orders\n",
		len(restaurants), len(menu), len(customers), nOrders)
}

func reset(db *gorm.DB) error {
	mods := []interface{}{&models.OrderItem{}, &models.Order{}, &models.MenuItem{}, &models.Customer{}, &models.Restaurant{}}
	for _, m := range mods {
		if err := db.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(m).Error; err != nil {
			return err
		}
	}
	return db.Exec("TRUNCATE order_items, orders, menu_items, customers, restaurants CASCADE").Error
}

func seedRestaurants(rng *rand.Rand, db *gorm.DB) []models.Restaurant {
	out := make([]models.Restaurant, 0, nRestaurants)
	for i := 0; i < nRestaurants; i++ {
		now := time.Now().Add(-time.Duration(i) * time.Hour)
		status := pick(rng, statuses)
		if i == 0 {
			status = models.RestaurantActive // guarantees a usable "Demo Restaurant"
		}
		name := uniqueName(i, restNames)
		r := models.Restaurant{
			ID:          uuid.NewString(),
			Name:        name,
			Description: "Family-run buka serving " + pick(rng, cuisines) + " cuisine.",
			CuisineType: pick(rng, cuisines),
			Address:     fmt.Sprintf("%d, %s Street", 1+i, pick(rng, areas)),
			City:        pick(rng, cities),
			Rating:      decimal.NewFromInt(int64(rng.Intn(4)+1)).Add(decimal.NewFromFloat(0.5 * float64(rng.Intn(2)))),
			Status:      status,
			Phone:       fmt.Sprintf("+2348%08d", rng.Intn(90000000)+10000000),
			Email:       fmt.Sprintf("hello%d@%s.ng", i, slug(name)),
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := db.Create(&r).Error; err != nil {
			log.Fatalf("restaurant %d: %v", i, err)
		}
		out = append(out, r)
	}
	return out
}

func seedMenu(rng *rand.Rand, db *gorm.DB, restaurants []models.Restaurant) []models.MenuItem {
	out := make([]models.MenuItem, 0, nRestaurants*nMenuPerRest)
	for _, r := range restaurants {
		for j := 0; j < nMenuPerRest; j++ {
			now := time.Now()
			price := decimal.NewFromInt(int64(rng.Intn(35)+4)).Add(decimal.NewFromInt(int64(rng.Intn(6))).Div(decimal.NewFromInt(2)))
			mi := models.MenuItem{
				ID:                     uuid.NewString(),
				RestaurantID:           r.ID,
				Name:                   uniqueItem(r.Name, j, itemNames),
				Description:            "Freshly prepared, great with your favourite sides.",
				Price:                  price,
				Available:              rng.Intn(10) < 8,
				Category:               pick(rng, []string{"Rice & Stews", "Swallow & Soups", "Grills & Suya", "Small Chops", "Drinks & Desserts"}),
				PreparationTimeMinutes: 10 + rng.Intn(30),
				CreatedAt:              now,
				UpdatedAt:              now,
			}
			if err := db.Create(&mi).Error; err != nil {
				log.Fatalf("menu item %s: %v", r.Name, err)
			}
			out = append(out, mi)
		}
	}
	return out
}

func seedCustomers(rng *rand.Rand, db *gorm.DB) []models.Customer {
	out := make([]models.Customer, 0, nCustomers)
	for i := 0; i < nCustomers; i++ {
		now := time.Now().Add(-time.Duration(i) * time.Hour)
		first := pick(rng, catNames)
		last := pick(rng, catNames)
		c := models.Customer{
			ID:        uuid.NewString(),
			Email:     fmt.Sprintf("%s.%s%d@example.com", slug(first), slug(last), i),
			Phone:     fmt.Sprintf("+2349%08d", rng.Intn(90000000)+10000000),
			FirstName: first,
			LastName:  last,
			Address:   fmt.Sprintf("%d Queen's Road", 1+i),
			City:      pick(rng, cities),
			Status:    pick(rng, []string{models.CustomerActive, models.CustomerActive, models.CustomerInactive}),
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := db.Create(&c).Error; err != nil {
			log.Fatalf("customer %d: %v", i, err)
		}
		out = append(out, c)
	}
	return out
}

func seedOrders(rng *rand.Rand, db *gorm.DB, restaurants []models.Restaurant, customers []models.Customer, menu []models.MenuItem) {
	// index menu items by restaurant for fast per-order selection
	byRest := map[string][]models.MenuItem{}
	for _, mi := range menu {
		byRest[mi.RestaurantID] = append(byRest[mi.RestaurantID], mi)
	}
	for i := 0; i < nOrders; i++ {
		cu := customers[rng.Intn(len(customers))]
		rest := restaurants[rng.Intn(len(restaurants))]
		if len(byRest[rest.ID]) == 0 {
			continue
		}
		now := time.Now().Add(-time.Duration(i) * time.Minute)

		order := models.Order{
			ID:              uuid.NewString(),
			CustomerID:      cu.ID,
			RestaurantID:    rest.ID,
			Status:          pick(rng, []string{models.OrderPending, models.OrderConfirmed, models.OrderPreparing, models.OrderReady, models.OrderOutForDelivery, models.OrderDelivered, models.OrderCancelled}),
			DeliveryAddress: cu.Address,
			DeliveryCity:    cu.City,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		count := 1 + rng.Intn(nOrderItems)
		total := decimal.Zero
		for j := 0; j < count; j++ {
			mi := byRest[rest.ID][rng.Intn(len(byRest[rest.ID]))]
			qty := 1 + rng.Intn(3)
			subtotal := mi.Price.Mul(decimal.NewFromInt(int64(qty)))
			total = total.Add(subtotal)
			order.Items = append(order.Items, models.OrderItem{
				ID:         uuid.NewString(),
				OrderID:    order.ID,
				MenuItemID: mi.ID,
				Quantity:   qty,
				UnitPrice:  mi.Price,
				Subtotal:   subtotal,
				CreatedAt:  now,
			})
		}
		order.TotalAmount = total
		if order.Status == models.OrderDelivered {
			d := now.Add(20 * time.Minute)
			order.DeliveredAt = &d
		}
		if err := db.Omit("Items").Create(&order).Error; err != nil {
			log.Fatalf("order %d: %v", i, err)
		}
		for j := range order.Items {
			order.Items[j].OrderID = order.ID
		}
		if err := db.Create(&order.Items).Error; err != nil {
			log.Fatalf("order items %d: %v", i, err)
		}
	}
}

func pick[T any](rng *rand.Rand, list []T) T {
	return list[rng.Intn(len(list))]
}

func uniqueName(i int, list []string) string {
	return fmt.Sprintf("%s %d", base(i, list), i+1)
}

func uniqueItem(restName string, j int, list []string) string {
	return fmt.Sprintf("%s (%s %d)", base(j, list), short(restName), j+1)
}

func base(i int, list []string) string {
	return list[i%len(list)]
}

func short(s string) string {
	if len(s) <= 12 {
		return s
	}
	return s[:12]
}

func slug(s string) string {
	var nb = make([]rune, 0, len(s))
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			nb = append(nb, lower(r))
		}
	}
	out := string(nb)
	if out == "" {
		return "eatery"
	}
	return out
}

func lower(r rune) rune {
	if r >= 'A' && r <= 'Z' {
		return r + 32
	}
	return r
}