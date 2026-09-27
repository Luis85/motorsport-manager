class_name ReplayPlayback
extends RefCounted
## Reconstructs a recorded session independently from the live-session scheduler.
## The application loop calls advance; a visual workspace only reads status or requests play.
var player: RaceReplay
var playing = false
var budget = 16

func advance() -> void:
	if not playing or player == null:
		return
	player.tick(clampi(budget, 1, 64))
	if player.verified or not player.error.is_empty():
		playing = false
