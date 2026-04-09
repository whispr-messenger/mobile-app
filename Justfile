default:
    just --list

up ENV:
    docker compose -f docker/{{ENV}}/compose.yml up -d --build

down ENV:
    docker compose -f docker/{{ENV}}/compose.yml down --volumes

logs ENV:
    docker compose -f docker/{{ENV}}/compose.yml logs expo --follow

