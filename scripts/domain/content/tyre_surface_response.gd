class_name TyreSurfaceResponse
extends RefCounted
## Same supported curve family in the live model and its coarse forecast.
static func factor(spec: Dictionary, water: float) -> float:
	var r: Dictionary = spec.response
	if spec.family == "slick": return maxf(r.dry_floor, 1 - maxf(0, water - r.dry_onset) * r.dry_loss)
	if spec.family == "intermediate": return r.inter_base + water * r.inter_gain - maxf(0, water - r.inter_peak) * r.inter_loss
	return r.wet_base + water * r.wet_gain
