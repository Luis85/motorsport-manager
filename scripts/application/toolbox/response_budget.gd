class_name DeveloperResponseBudget
extends RefCounted
## Exact compact UTF-8 JSON accounting, including the batch envelope and reserved tail.
var bytes: int
var _limit: int
var _receipts: Array


func _init(response: Dictionary, limit_bytes: int) -> void:
	bytes = size_of(response)
	_limit = limit_bytes
	_receipts = response.result.responses


func fits() -> bool:
	return bytes <= _limit


func required_bytes(index: int, receipt: Dictionary) -> int:
	return bytes - size_of(_receipts[index]) + size_of(receipt)


func replace(index: int, receipt: Dictionary) -> bool:
	var required: int = required_bytes(index, receipt)
	if required > _limit:
		return false
	_receipts[index] = receipt
	bytes = required
	return true


static func size_of(response: Dictionary) -> int:
	# Match the JSON transport exactly: compact, sorted keys and full numeric precision.
	return JSON.stringify(response, "", true, true).to_utf8_buffer().size()
