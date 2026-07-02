PORT ?= 8000

dev:
	python3 -m http.server $(PORT)

sync-filters:
	node sync-filters.js

sync-profiles:
	node sync-profiles.js

sync: sync-filters sync-profiles

.PHONY: dev sync sync-filters sync-profiles