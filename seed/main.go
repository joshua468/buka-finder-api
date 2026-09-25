package main

import (
	"crypto/sha256"
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
// then inserts the same data every run. Same seed value -> same data — down
// to the UUIDs: detID hashes (seed, kind, ordinal) so every run produces the
// exact same primary keys. A thrown-away local run and a fresh production run
// therefore differ in nothing but the wall clock.

const (
	nRestaurants = 350
	nCustomers   = 320
	nMenuPerRest = 10 // 10 items per restaurant => 3,500 items
	nOrders      = 2100
	nOrderItems  = 4 // avg items per order
	seed         = 20240601
)

// baseTime fixes every generated timestamp so seed runs are identical.
var baseTime = time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)

var (
	// orderItemOrdinal guarantees unique order-item IDs across all orders.
	orderItemOrdinal = 0
	// city-area pairs so addresses are geographically consistent
	// ("Ibadan · Victoria Island Street" would read as a seed bug)
	cityAreas = []struct{ city, area string }{
		{"Lagos", "Victoria Island"},
		{"Lagos", "Lekki Phase 1"},
		{"Lagos", "Surulere"},
		{"Abuja", "Gwarinpa"},
		{"Abuja", "Garki"},
		{"Abuja", "Wuse"},
		{"Port Harcourt", "GRA Phase 2"},
		{"Port Harcourt", "Rumuola"},
		{"Ibadan", "Ring Road"},
		{"Ibadan", "Bodija"},
		{"Kano", "Nassarawa GRA"},
		{"Enugu", "New Haven"},
		{"Benin City", "Ekiosa"},
		{"Benin City", "Ugbowo"},
	}
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
	// unique rating: 350 distinct values spread 1.50–5.00 to 2 decimals, so
	// every card shows a different rating. A shuffled order keeps adjacent
	// restaurants from looking like a sequence (4.50, 4.51, 4.52...).
	ratingOrder := rng.Perm(nRestaurants)
	var rating []decimal.Decimal
	for _, pos := range ratingOrder {
		rating = append(rating, decimal.NewFromFloat(1.5+3.5*float64(pos)/float64(nRestaurants-1)).Round(2))
	}
	for i := 0; i < nRestaurants; i++ {
		now := baseTime.Add(-time.Duration(nRestaurants-i) * time.Hour)
		status := pick(rng, statuses)
		if i == 0 {
			status = models.RestaurantActive // guarantees a usable "Demo Restaurant"
		}
		name := uniqueName(i, restNames)
		loc := pick(rng, cityAreas)
		houseNo := rng.Intn(850) + 1
		r := models.Restaurant{
			ID:          detID("restaurant", i),
			Name:        name,
			Description: "Family-run buka serving " + pick(rng, cuisines) + " cuisine.",
			CuisineType: pick(rng, cuisines),
			Address:     fmt.Sprintf("%d, %s", houseNo, loc.area),
			City:        loc.city,
			Rating:      rating[i],
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

// itemDescriptions gives each seeded base dish its own line so the cart doesn't
// read "Freshly prepared, great with your favourite sides." for everything.
var itemDescriptions = map[string]string{
	"Jollof Rice with Chicken": "Smoky party jollof with juicy grilled chicken and plantain.",
	"Fried Rice":               "Wok-fried rice with liver, shrimp, sweetcorn and green peas.",
	"Ofada Rice with Ayamase":  "Locally grown ofada rice in fiery green pepper ayamase.",
	"Amala with Gbegiri":       "Smooth amala with honey-brown gbegiri, ewedu and assorted meat.",
	"Pounded Yam":              "Soft pounded yam served with your choice of rich soup.",
	"Efo Riro":                 "Rich tomato and pepper stew with spinach, stockfish and locust beans.",
	"Egusi Soup":               "Ground egusi with bitterleaf, assorted meat and catfish.",
	"Ogbono Soup":              "Slippery ogbono thickened the traditional way, with stockfish.",
	"Groundnut Soup":          "Silky peanut-based soup with beef and chunks of stockfish.",
	"Okro Soup":                "Fresh okro with palm oil, periwinkle and finely sliced ugwu.",
	"Vegetable Soup":           "Edikang-ikong style greens with goat meat and smoked fish.",
	"Edikang Ikong":            "Luxurious leafy soup with pumpkin, waterleaf and assorted meat.",
	"White Soup":               "Peppery ofe nsala with goat meat and uziza leaves.",
	"Banga Soup":               "Palm-nut banga with beletete leaves and whole heat.",
	"Pepper Soup":              "Spicy clear broth with tender meat and lemony uziza.",
	"Boli (Roast Plantain)":    "Charred roast plantain with a spicy pepper and groundnut dip.",
	"Suya Skewers":            "Flame-grilled beef skewers dusted in spicy yaji and onions.",
	"Kilishi":                  "Thin spiced beef strips, sun-dried and grilled to crispy.",
	"Nkwobi":                   "Spicy cow foot in palm-oil sauce with utazi and yam cubes.",
	"Asun":                     "Smoky goat meat tossed in fiery pepper and onions.",
	"Peppered Snail":           "Snails sizzled in pepper sauce with uziza and onion.",
	"Grilled Catfish":          "Whole catfish flame-grilled with pepper sauce and plantain.",
	"Moi Moi":                  "Steamed bean pudding with egg, fish and bell peppers.",
	"Akara":                    "Crispy bean fritters, golden outside and fluffy within.",
	"Puff Puff":                "Deep-fried dough balls, sweet and fluffy with a soft crumb.",
	"Chin Chin":                "Crunchy bite-sized pastry, perfectly sugar-dusted.",
	"Plantain Mosa":            "Crispy plantain bites seasoned with pepper, onion and ginger.",
	"Zobo Drink":               "Chilled hibiscus zobo with ginger, pineapple and a little spice.",
	"Kunun Aya":                "Creamy tiger-nut milk with a hint of ginger and clove.",
	"Chapman":                  "Fruity Nigerian chapman with cucumber, grenadine and bitters.",
}

func seedMenu(rng *rand.Rand, db *gorm.DB, restaurants []models.Restaurant) []models.MenuItem {
	out := make([]models.MenuItem, 0, nRestaurants*nMenuPerRest)
	for ri, r := range restaurants {
		for j := 0; j < nMenuPerRest; j++ {
			now := baseTime
			itemName := base(j, itemNames)
			category := itemCategory(itemName)
			mi := models.MenuItem{
				ID:                     detID("menu", ri*nMenuPerRest+j),
				RestaurantID:           r.ID,
				Name:                   uniqueItem(r.Name, j, itemNames),
				Description:            itemDescriptions[base(j, itemNames)],
				Price:                  menuPrice(rng, category, base(j, itemNames)),
				Available:              rng.Intn(10) < 8,
				Category:               category,
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

// Staple prices at a Nigerian food-delivery app, keyed by the seeded base item
// name. [lo, hi] in NGN, rounded to the nearest ₦50. Money is DECIMAL(10,2) in
// the DB; never floats.
var streetMenuPrices = map[string][2]int{
	"Jollof Rice with Chicken": {4500, 7000},
	"Fried Rice":               {4500, 7000},
	"Ofada Rice with Ayamase":  {5500, 9000},
	"Amala with Gbegiri":       {3500, 5500},
	"Pounded Yam":              {3500, 6000},
	"Efo Riro":                 {4500, 7000},
	"Egusi Soup":               {4500, 7000},
	"Ogbono Soup":              {4500, 7000},
	"Groundnut Soup":           {4500, 7000},
	"Okro Soup":                {4500, 7000},
	"Vegetable Soup":           {4500, 7000},
	"Edikang Ikong":            {5500, 8500},
	"White Soup":               {5000, 8000},
	"Banga Soup":               {4000, 6500},
	"Pepper Soup":              {6000, 10000},
	"Boli (Roast Plantain)":    {2000, 3500},
	"Suya Skewers":             {3500, 6000},
	"Kilishi":                  {2500, 4000},
	"Nkwobi":                   {6500, 11000},
	"Asun":                     {6000, 10000},
	"Peppered Snail":           {6500, 10000},
	"Grilled Catfish":          {7000, 13000},
	"Moi Moi":                  {5000, 7000},
	"Akara":                    {2000, 3000},
	"Puff Puff":                {2000, 3000},
	"Chin Chin":                {2000, 3000},
	"Plantain Mosa":            {2500, 4000},
	"Zobo Drink":               {2000, 3000},
	"Kunun Aya":                {2000, 3000},
	"Chapman":                  {2500, 3500},
}

// menuPrice returns a realistic NGN price for the dish, rounded to the nearest
// ₦50, falling back to a category band for unknown items. Prices start at
// ₦2,000 and go up by item — never zero, never a handful of naira.
// itemCategory returns the menu category that actually fits each dish, instead
// of assigning one at random (so Amala is never a small chop).
func itemCategory(itemName string) string {
	switch itemName {
	case "Jollof Rice with Chicken", "Fried Rice", "Ofada Rice with Ayamase":
		return "Rice & Stews"
	case "Efo Riro", "Egusi Soup", "Ogbono Soup", "Groundnut Soup", "Okro Soup",
		"Vegetable Soup", "Edikang Ikong", "White Soup", "Banga Soup", "Pepper Soup":
		return "Swallow & Soups"
	case "Pounded Yam", "Amala with Gbegiri":
		return "Swallow & Soups"
	case "Suya Skewers", "Kilishi", "Nkwobi", "Asun", "Peppered Snail", "Grilled Catfish":
		return "Grills & Suya"
	case "Moi Moi", "Akara", "Puff Puff", "Chin Chin", "Plantain Mosa", "Boli (Roast Plantain)":
		return "Small Chops"
	case "Zobo Drink", "Chapman", "Kunun Aya":
		return "Drinks & Desserts"
	}
	return "Rice & Stews"
}

// menuPrice returns the dish price as KOBO (naira * 100) so the API carries
// money without decimals, rounded to the nearest ₦50. Nothing is under ₦3,000.
func menuPrice(rng *rand.Rand, category, itemName string) decimal.Decimal {
	band, ok := streetMenuPrices[itemName]
	if !ok {
		switch category {
		case "Rice & Stews":
			band = [2]int{4500, 7500}
		case "Swallow & Soups":
			band = [2]int{4000, 7500}
		case "Grills & Suya":
			band = [2]int{3500, 9000}
		case "Small Chops":
			band = [2]int{3000, 5000}
		default:
			band = [2]int{3000, 4500}
		}
	}
	lo, hi := band[0], band[1]
	n := lo + rng.Intn((hi-lo)/50+1)*50
	return decimal.NewFromInt(int64(n) * 100) // naira -> kobo
}

func seedCustomers(rng *rand.Rand, db *gorm.DB) []models.Customer {
	out := make([]models.Customer, 0, nCustomers)
	for i := 0; i < nCustomers; i++ {
		now := baseTime.Add(-time.Duration(nCustomers-i) * time.Hour)
		first := pick(rng, catNames)
		last := pick(rng, catNames)
		// house-number surplus; area + city stay consistent
		loc := pick(rng, cityAreas)
		c := models.Customer{
			ID:        detID("customer", i),
			Email:     fmt.Sprintf("%s.%s%d@example.com", slug(first), slug(last), i),
			Phone:     fmt.Sprintf("+2349%08d", rng.Intn(90000000)+10000000),
			FirstName: first,
			LastName:  last,
			Address:   fmt.Sprintf("%d, %s", rng.Intn(850)+1, loc.area),
			City:      loc.city,
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
		now := baseTime.Add(-time.Duration(nOrders-i) * time.Minute)

		order := models.Order{
			ID:              detID("order", i),
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
			orderItemOrdinal++
			order.Items = append(order.Items, models.OrderItem{
				ID:         detID("order_item", orderItemOrdinal),
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

// detID derives a deterministic RFC 4122 v4-format UUID from
// (seed, kind, ordinal). Same inputs on any machine, any Postgres, any run.
func detID(kind string, ordinal int) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%d", kind, seed, ordinal)))
	b := sum[:16]
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	var u uuid.UUID
	copy(u[:], b)
	return u.String()
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