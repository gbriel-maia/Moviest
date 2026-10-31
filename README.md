# Moviest – Catálogo Interativo de Filmes e Séries

## Objetivo

Aplicação web para organizar um catálogo de filmes e séries, praticando tipos, interfaces, funções, arrays, manipulação do DOM e eventos com TypeScript, com persistência em SQLite.

## Funcionalidades

- **Resumo** com Total, Assistidos e Para assistir, atualizado após cada alteração.
- **Capa opcional** para cada título: envie uma imagem (PNG, JPG, WEBP ou GIF, até 2 MB). Sem imagem, o sistema usa uma capa genérica.
- **Catálogo em cards** com a capa, com mensagens quando não há itens cadastrados ou quando a busca não retorna resultados.
- **Busca** por título e **filtro** por categoria, atualizando a lista em tempo real.
- **Atualizar estado** (assistido / para assistir) e **excluir** itens.
- **Persistência** dos dados em SQLite (`data/catalogo.db`, criado automaticamente). As imagens enviadas ficam em `data/uploads/` e são removidas junto com o item.

## Tecnologias

- HTML5 e CSS3
- TypeScript (front-end e back-end, modo `strict`)
- Node.js 18+ e Express
- SQLite via `better-sqlite3`
- Docker (opcional)

## Como executar

### Opção 1: localmente

Pré-requisitos: [Node.js](https://nodejs.org/) 18 ou superior e npm. O `better-sqlite3` usa binários pré-compilados; se não houver um para o seu sistema, é preciso ter as ferramentas de compilação nativas (Python, make e um compilador C++).

```bash
git clone <url-do-repositorio>
cd moviest

npm install        # instala as dependências
npm run build      # compila o TypeScript (servidor -> dist/, cliente -> public/js/)
npm start          # inicia o servidor
```

Acesse <http://localhost:3000>.

- Outra porta: `PORT=8080 npm start`
- Compilar e iniciar de uma vez: `npm run dev`
- O banco é criado em `data/catalogo.db` na primeira execução e as capas enviadas ficam em `data/uploads/`. Para zerar o catálogo, pare o servidor e apague a pasta `data/`.

### Opção 2: com Docker

Pré-requisito: [Docker](https://docs.docker.com/get-docker/). Não é necessário ter Node.js instalado. A imagem instala as dependências e compila o projeto no `docker build`.

```bash
docker build -t moviest .
docker run -d --name moviest -p 3000:3000 -v moviest-data:/app/data moviest
```

Acesse <http://localhost:3000>.

- O volume `moviest-data` guarda o banco SQLite e as capas enviadas. Sem o `-v`, os dados são perdidos quando o container é removido.
- Outra porta no host: `-p 8080:3000` (acesse <http://localhost:8080>).
- Ver logs: `docker logs moviest`
- Parar e remover o container: `docker rm -f moviest`
- Apagar também os dados: `docker volume rm moviest-data`

## Scripts do npm

| Comando         | Descrição                                      |
| --------------- | ---------------------------------------------- |
| `npm run build` | Compila servidor (`dist/`) e cliente (`public/js/`) |
| `npm start`     | Inicia o servidor compilado                    |
| `npm run dev`   | Compila e inicia                               |

## API

| Método   | Rota                | Descrição                             |
| -------- | ------------------- | ------------------------------------- |
| `GET`    | `/api/categories`   | Lista as categorias                   |
| `GET`    | `/api/items`        | Lista os itens                        |
| `POST`   | `/api/items`        | Cadastra um item (`image` opcional: imagem como data URL base64) |
| `PATCH`  | `/api/items/:id`    | Altera o estado (`{"watched": true}`) |
| `DELETE` | `/api/items/:id`    | Remove um item                        |

## Estrutura

```
src/server/server.ts   API REST + SQLite
src/client/main.ts     lógica do front-end (DOM e eventos)
public/index.html      página
public/style.css       estilos
public/covers/         capas genéricas (SVG)
tsconfig.json          configuração do servidor
tsconfig.client.json   configuração do cliente
Dockerfile             imagem Docker
```
