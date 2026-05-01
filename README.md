# PriceSync — Control de Precios DocoGrow

Comparador de precios MercadoLibre vs Tienda Nube, con calculadora de precios óptimos y generador de CSV para actualización masiva en TN.

## Estructura

```
pricesync/
├── public/
│   └── index.html          # Frontend completo (single file)
├── netlify/
│   └── functions/
│       └── ml-proxy.js     # Proxy seguro a la API de MercadoLibre
├── netlify.toml            # Configuración de Netlify
├── package.json
└── .gitignore
```

## Variables de entorno en Netlify

| Variable | Descripción |
|---|---|
| `ML_CLIENT_ID` | Client ID de la app ML |
| `ML_CLIENT_SECRET` | Client Secret de la app ML |
| `ML_INITIAL_TOKEN` | Token inicial `APP_USR-...` |
| `ML_USER_ID` | ID de usuario ML (default: 122478) |

## Deploy

1. Conectar el repositorio en [netlify.com](https://netlify.com)
2. Configurar las variables de entorno
3. El deploy es automático con cada push a `main`

## Uso local

```bash
npm install -g netlify-cli
netlify dev
```

## Lógica de generación de CSV TN

| Caso ML | Precio TN | Precio Promocional TN |
|---|---|---|
| Sin promoción | Precio ML | Precio ML − 6% |
| Con promoción | Precio promo ML | Precio promo ML − 6% |
