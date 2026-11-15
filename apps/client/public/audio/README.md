# Áudio original de Dungeons & Friends

Estes efeitos e músicas são sintetizados pelo script `scripts/build-audio-assets.mjs`, com osciladores e ruído determinístico, sem samples externos. Os assets gerados são disponibilizados sob CC0-1.0. Não há atribuição de terceiros necessária.

Regenerar na raiz: `pnpm audio:build`. Requer `ffmpeg-static`, autorizado em `pnpm-workspace.yaml`. São 15 efeitos com 500 ms de silêncio entre clipes e duas faixas de 16 segundos para loop, codificados em Opus/WebM e MP3 a 128 kbps. O JSON registra offset e duração em milissegundos.
