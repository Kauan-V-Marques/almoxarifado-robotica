<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0D1117,50:1F6FEB,100:58A6FF&height=110&section=header" alt="" width="100%">
</p>

<h1 align="center">Almoxarifado da Equipe de Robótica</h1>

<p align="center"><b>Full stack em TypeScript · React · Fastify · PostgreSQL</b></p>

<p align="center">
  <a href="https://github.com/Kauan-V-Marques/almoxarifado-robotica/actions/workflows/ci.yml"><img src="https://github.com/Kauan-V-Marques/almoxarifado-robotica/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
</p>

<p align="center">
  <a href="https://kauan-v-marques.github.io/almoxarifado-robotica/"><b>Abrir a demonstração</b></a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#segurança-e-regras">Segurança e regras</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#como-rodar">Como rodar</a> ·
  <a href="#testes">Testes</a>
</p>

---

Sistema web **full stack em TypeScript** para controlar o almoxarifado de uma equipe de robótica: quais componentes existem (sensores, motores, microcontroladores, baterias...), quem pegou o quê emprestado, o que está atrasado e o que precisa ser reposto.

**[Abrir a demonstração](https://kauan-v-marques.github.io/almoxarifado-robotica/)**: entre como capitão ou como membro com um clique. Na demonstração a API é simulada no próprio navegador e os dados são fictícios.

| Painel | Componentes |
|---|---|
| ![Painel do capitão](docs/painel.png) | ![Lista de componentes](docs/componentes.png) |

## Funcionalidades

- **Login com dois papéis:**
  - o **capitão** cadastra componentes e membros e vê os empréstimos de todos
  - o **membro** pega emprestado e devolve só os próprios itens
- **Estoque:** o disponível é calculado como total menos o que está emprestado, com alerta de estoque mínimo
- **Empréstimos:** com prazo, finalidade e marcação automática de atraso
- **Painel:** resumo, itens para repor, empréstimos do usuário e atrasos da equipe
- **Validação compartilhada:** os mesmos schemas Zod validam os formulários no front e as requisições na API

## Segurança e regras

| O quê | Como |
|---|---|
| Senhas | `scrypt` com salt aleatório (nativo do Node), comparadas em tempo constante |
| Sessão | Access token JWT de **15 min** só na memória do navegador, e refresh token aleatório em cookie **httpOnly + SameSite=Strict** |
| Refresh | **Rotação:** cada refresh token vale uma vez, e no banco fica só o hash SHA-256 dele. O logout revoga o token |
| Força bruta | Limite de tentativas de login por IP, e a mesma mensagem para e-mail inexistente e senha errada |
| Permissões | Rotas do capitão bloqueadas no back-end (403), não só escondidas no front |
| Concorrência | O empréstimo trava a linha do componente (`SELECT ... FOR UPDATE`): dois pedidos simultâneos pela última peça não passam juntos |

## Arquitetura

```mermaid
flowchart LR
    subgraph web [apps/web · React]
      UI[Páginas + React Hook Form] --> Q[TanStack Query]
      Q --> C[cliente HTTP<br/>renova o token sozinho]
    end
    subgraph api [apps/api · Fastify]
      R[Rotas + Zod] --> D[Drizzle ORM]
    end
    S[packages/shared<br/>schemas Zod e tipos] -.-> UI
    S -.-> R
    C -- "/api (JWT + cookie)" --> R
    D --> P[(PostgreSQL)]
```

| Camada | Tecnologias |
|---|---|
| Front-end | React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS |
| Back-end | Node.js 24, Fastify 5, Drizzle ORM, PostgreSQL 18, JWT, Zod |
| Testes | Vitest, Testing Library, MSW, PostgreSQL real na API |
| Infra | npm workspaces (monorepo), Docker, nginx, GitHub Actions, GitHub Pages |

```text
apps/api/        API Fastify (rotas, autenticação, banco, migrations SQL)
apps/web/        front-end React (páginas, cliente HTTP, API simulada para a demo)
packages/shared/ schemas de validação e tipos usados pelos dois lados
```

## Como rodar

**Tudo com Docker** (PostgreSQL + API + front com nginx):

```bash
docker compose up --build
```

Depois abra http://localhost:8080 e entre com `capitao@almox.dev` ou `ana@almox.dev` (senha `robotica123`).

**Em modo desenvolvimento:**

```bash
npm install
docker compose up -d db
npm run db:seed                         # migrations + dados de exemplo
JWT_SECRET=um-segredo-com-pelo-menos-32-caracteres npm run dev:api
npm run dev:web                         # http://localhost:5173
```

## Testes

```bash
npm test
```

São 35 testes no total.

**API (24 testes, contra PostgreSQL real):**
- login, validação e mensagem igual para e-mail ou senha errados
- token inválido, rotação e revogação do refresh, limite de tentativas
- permissões de capitão e membro
- cálculo do disponível, empréstimo acima do estoque e devolução por terceiros
- atrasos, cadastro de membros
- **dois empréstimos simultâneos pela última unidade:** só um passa
- **quatro réplicas subindo juntas:** as migrations e o seed rodam uma vez só (advisory lock no PostgreSQL)
- atrás de proxy, o limite de login vale por cliente (`X-Forwarded-For`, com `TRUST_PROXY=true`)
- o banco derrubando as conexões (reinício, failover) não derruba a API

**Front (11 testes, com MSW simulando a API):**
- validação do formulário e erro do servidor no login
- redirecionamento depois do login para a página pedida
- rotas protegidas
- cadastro, busca e empréstimo de componentes
- renovação automática do token expirado

O GitHub Actions roda lint, tipos, testes (com PostgreSQL 18) e build, constrói as duas imagens Docker e publica a demonstração no GitHub Pages.

O deploy em Kubernetes (Helm + Terraform, testado num cluster de verdade na CI) fica no repositório [infra-kubernetes-terraform](https://github.com/Kauan-V-Marques/infra-kubernetes-terraform).

---

<details>
<summary>English</summary>

### Robotics Team Parts Inventory

A **full-stack TypeScript** app (React + Fastify + PostgreSQL) to manage a robotics team's parts inventory and loans.

- Role-based access (captain/member), enforced on the API
- Secure auth: scrypt password hashing, 15-minute JWT access tokens kept in memory, rotating refresh tokens in httpOnly SameSite=Strict cookies (only SHA-256 hashes stored), login rate limiting
- Row-level locking prevents concurrent loans from overdrawing stock (covered by a test)
- Shared Zod schemas validate both the forms and the API
- 32 tests (API against real PostgreSQL, front-end with Testing Library + MSW), Docker images, CI and a live demo on GitHub Pages with an in-browser mocked API

</details>

---

<p align="center">
  Feito por <a href="https://github.com/Kauan-V-Marques"><b>Kauan Victor Marques</b></a> ·
  <a href="https://kauan-v-marques.github.io/curriculo/">Currículo</a> ·
  <a href="https://github.com/Kauan-V-Marques?tab=repositories">Mais projetos</a>
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0D1117,50:1F6FEB,100:58A6FF&height=80&section=footer" alt="" width="100%">
</p>
