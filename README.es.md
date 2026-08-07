<div align="center">

# RateYourCommit

**Haz que la contribución de tu equipo de desarrollo sea transparente y explicable — una herramienta open-source de visibilidad de desempeño para equipos dev.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](#license)
[![Self-hosted](https://img.shields.io/badge/deploy-docker%20compose-2496ED.svg)](#empieza-en-5-minutos)
[![Version](https://img.shields.io/badge/version-0.0.1-lightgrey.svg)](#hoja-de-ruta)

<a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a> · <a href="README.zh.md">中文</a> · <b>Español</b>

[Por qué](#te-suena-familiar) · [Funcionalidades](#funcionalidades-clave) · [Empezar](#empieza-en-5-minutos) · [Política de IA](#dónde-usamos-ia-y-dónde-no) · [Hoja de ruta](#hoja-de-ruta)

</div>

---

## ¿Te suena familiar?

Si gestionas una organización de desarrollo pequeña o mediana, seguro has vivido momentos como estos.

- "Sé que fulano está haciendo un gran trabajo, pero si alguien me lo cuestionara, no podría señalar exactamente por qué."
- "La gente tiene varias cuentas de GitHub/GitLab, así que nada cuadra cuando intentamos ver quién hizo qué."
- "En cada ciclo de evaluación calificamos a ojo, y si alguien lo disputa, no tenemos nada concreto que mostrar."
- "Consideramos un SaaS de gestión de desempeño, pero nos incomoda enviar nuestro código y datos de RRHH a servidores de terceros."

RateYourCommit existe para resolver esto como software **open-source y autoalojado (self-hosted)**.

## Funcionalidades clave

- **🔗 Coincidencia automática de identidades** — Aunque una misma persona haga commits desde varias cuentas/correos de git, RateYourCommit encuentra los candidatos y los fusiona en una sola identidad. (Coincidencia basada en reglas; una persona siempre confirma con un clic.)
- **📊 Scorecards explicables** — Las métricas de entrega, calidad de código y colaboración se calculan con los pesos que tu organización define. Cada fórmula está completamente publicada y puede verificarse a mano en una hoja de cálculo.
- **🧹 Exclusión automática de valores atípicos** — Cosas como "commitear una librería entera de golpe" se detectan automáticamente y se excluyen del cálculo de puntaje.
- **🔌 Arquitectura de conectores** — Conecta las herramientas que ya usas: GitHub, GitLab, Jira, Linear y más. Añadir una integración nueva es solo un plugin más.
- **🔒 Totalmente autoalojado** — Ni tu código ni tus datos de evaluación salen jamás de tus propios servidores.

## Dónde usamos IA (y dónde no)

Este es el principio más importante de todo el proyecto.

> **Nunca usamos IA en ningún cálculo que afecte directamente la compensación o la calificación.** Todo son reglas y estadísticas que una persona puede verificar a mano.

La IA (un LLM) se usa, de forma opcional, en exactamente dos lugares — ambos son ayudas puramente de referencia que nunca tocan el puntaje final (resumir mensajes de commit, resumir comentarios de evaluación entre pares). Incluso para esto está previsto poder elegir entre un LLM local propio y una API externa. Consulta [`docs/AI-POLICY.md`](docs/AI-POLICY.md) para más detalles.

## Empieza en 5 minutos

```bash
git clone https://github.com/<your-username>/rate-your-commit
cd rate-your-commit
cp .env.example .env       # configuración mínima: token de GitHub, etc.
docker compose up -d       # levanta web + worker + postgres juntos
```

Abre `http://localhost:3000` → conecta un repositorio → revisa tu primer dashboard unos minutos después. No necesitas una persona dedicada a infraestructura — con un solo desarrollador de tu equipo basta. Consulta [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para la arquitectura completa.

## Capturas de pantalla

> _(Repositorio público en preparación — las capturas reales del dashboard se añadirán con el primer release.)_

## Hoja de ruta

- [x] **0.0.1** — Diseño de pantallas, diseño de arquitectura, licencia/gobernanza, README, andamiaje inicial del repositorio
- [x] **v1.0** — Mapeo de identidades + integración de Git/issue tracker + scorecard personal (conector de GitHub)
- [x] **v1.1** — Conectores de GitLab / Jira / Linear
- [x] **v1.2** — Inicio de sesión con email/contraseña, control de acceso basado en roles (admin/member), protección CSRF (versión actual)
- [x] **v1.3** — Jerarquía de equipos, alertas de riesgo en el dashboard, flujo de confirmación/finalización de nivel de compensación
- [ ] v2.0 — Módulo de evaluación entre pares (360°)
- [ ] v2.1 — Pantalla de agregación de desempeño por proyecto, flujo de aprobación en dos etapas para compensación (PM → RRHH)
- [ ] RateYourCommit Cloud — hosting gestionado + funcionalidades asistidas por LLM (de pago)

## Cómo contribuir

Acabamos de terminar el andamiaje inicial. Deja tus comentarios como un issue, o sigue `CONTRIBUTING.md` para participar. **Los PRs que toquen la lógica de puntuación (`packages/scoring`) siempre requieren la aprobación de al menos un code owner** — la confianza en este proyecto nace de la promesa de que "el cálculo es transparente".

## License

[GNU AGPL v3.0](LICENSE). Eres libre de autoalojar, modificar y redistribuir, pero si operas este código como un servicio de red, también debes publicar tu código fuente modificado. Es la elección que mantiene el núcleo open-source permanentemente libre.

---

<div align="center">
<sub>Si crees que este proyecto puede serte útil, por favor dale una ⭐ — cuántos equipos lo necesitan es justo lo que guía nuestra próxima ronda de inversión.</sub>
</div>
