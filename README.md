# Nolwazi Ntuli — Portfolio

A personal portfolio site built with Blazor Server (.NET 8), showcasing my work bridging business strategy and software engineering — including [FunduLwazi](https://fundulwazi-ethjdqbpgnbpbvek.southafricanorth-01.azurewebsites.net), an AI-powered document intelligence platform.

## Tech stack

- **ASP.NET Core 8 / Blazor Server** — interactive server-side rendering
- **Fraunces, Inter & Caveat** — display, body, and accent fonts
- **Three.js (WebGL)** — the click-to-bloom flower easter egg
- **AOS** — scroll reveal animations
- **Lucide** — icon set for the Technology section

## Features

- Warm, personal design system (clay/terracotta palette, botanical monogram)
- Click anywhere on the page to bloom an animated flower
- Sections: Hero, Journey, Why I Build, FunduLwazi (flagship project), Projects, Technology, Experience, Contact
- Hardened for production: CSP, Subresource Integrity on third-party scripts, rate limiting, clickjacking protection

## Getting started

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download).

```bash
dotnet restore
dotnet run
```

Then open `http://localhost:5155` (or whichever port is printed in the console).

## Project structure

```
Components/          Razor components (Hero, Journey, FunduLwazi, etc.)
Components/Layout/    Main layout and navigation
Pages/                 Routable pages
wwwroot/               Static assets — CSS, JS, images, CV
```

## Deployment

Configured for Azure App Service. Security headers and rate limiting are set up in `Program.cs`.
