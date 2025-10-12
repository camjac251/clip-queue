.PHONY: help api-setup api-dev api-build web-dev web-build dev-all install clean

help:
	@echo "Clip Queue - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install     - Install all dependencies"
	@echo "  make api-setup   - Get Twitch bot token (OAuth)"
	@echo ""
	@echo "Development:"
	@echo "  make api-dev     - Run backend API server"
	@echo "  make web-dev     - Run frontend dev server"
	@echo "  make dev-all     - Run both backend + frontend"
	@echo ""
	@echo "Build:"
	@echo "  make api-build   - Build backend"
	@echo "  make web-build   - Build frontend for production"
	@echo "  make build       - Build everything"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make typecheck   - Type check all packages"
	@echo "  make lint        - Lint all packages"
	@echo "  make test        - Run all tests"

# Setup
install:
	pnpm install

api-setup:
	turbo run setup --filter=@cq/api

# Development
api-dev:
	turbo run dev --filter=@cq/api

web-dev:
	turbo run dev --filter=@cq/web

dev-all:
	turbo run dev --filter=@cq/api --filter=@cq/web

# Build
api-build:
	turbo run build --filter=@cq/api

web-build:
	turbo run build --filter=@cq/web

build:
	turbo run build

# Utilities
clean:
	find . -name 'dist' -type d -prune -exec rm -rf {} +
	find . -name 'node_modules' -type d -prune -exec rm -rf {} +
	find . -name '.turbo' -type d -prune -exec rm -rf {} +
	rm -rf .turbo

typecheck:
	turbo run typecheck

lint:
	turbo run lint

lint-fix:
	turbo run lint:fix

format:
	turbo run format

test:
	turbo run test

test-coverage:
	turbo run test:coverage

# Docker
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker logs clip-queue-backend -f

docker-restart:
	docker-compose up -d --build
