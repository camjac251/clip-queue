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
	pnpm --filter @cq/api run setup

# Development
api-dev:
	pnpm --filter @cq/api run dev

web-dev:
	pnpm --filter @cq/web run dev

dev-all:
	pnpm run --parallel --filter @cq/api --filter @cq/web dev

# Build
api-build:
	pnpm --filter @cq/api run build

web-build:
	pnpm --filter @cq/web run build

build:
	pnpm --recursive build

# Utilities
clean:
	find . -name 'dist' -type d -prune -exec rm -rf {} +
	find . -name 'node_modules' -type d -prune -exec rm -rf {} +

typecheck:
	pnpm --recursive typecheck

lint:
	pnpm --recursive lint

lint-fix:
	pnpm --recursive lint:fix

format:
	pnpm --recursive format

test:
	pnpm test

test-coverage:
	pnpm test:coverage

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
