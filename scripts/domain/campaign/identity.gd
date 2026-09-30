class_name CampaignIdentity
extends RefCounted
## Stable inert identifiers used across campaign snapshots and weekend mappings.
const MAX_LENGTH = 96

static func valid(value: Variant) -> bool:
	if not value is String or value.is_empty() or value.length() > MAX_LENGTH:
		return false
	for character in value:
		if character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-":
			return false
	return true

static func valid_hash(value: Variant) -> bool:
	return value is String and value.length() == 64 and value.is_valid_hex_number(false)
