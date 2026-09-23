package validation

import (
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

// Errors maps validator messages to the field name the client should fix.
// Returns nil when the struct is valid, else a map of field -> human message.
// Used by POST/PATCH to answer 422 VALIDATION_ERROR with the field named
// (Task 1 step 4: a POST with a missing required field must say which one).
func Errors(name string, s interface{}) map[string]string {
	err := validate.Struct(s)
	if err == nil {
		return nil
	}
	if _, ok := err.(*validator.InvalidValidationError); ok {
		return nil
	}
	out := map[string]string{}
	ve := err.(validator.ValidationErrors)
	seen := map[string]bool{}
	for _, fe := range ve {
		field := fe.Field()
		// snake_case the field name for the JSON-facing contract
		snake := toSnake(field)
		if seen[snake] {
			continue
		}
		seen[snake] = true
		out[snake] = fieldMessage(fe.Tag(), fe.Param())
	}
	return out
}

func toSnake(s string) string {
	var b strings.Builder
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(r + 32)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func fieldMessage(tag, param string) string {
	switch tag {
	case "required":
		return "field is required"
	case "email":
		return "must be a valid email"
	case "uuid":
		return "must be a valid UUID"
	case "min":
		return "too short (min " + param + ")"
	case "max":
		return "too long (max " + param + ")"
	case "gte":
		return "must be >= " + param
	case "lte":
		return "must be <= " + param
	case "oneof":
		return "must be one of: " + param
	default:
		return "invalid value"
	}
}