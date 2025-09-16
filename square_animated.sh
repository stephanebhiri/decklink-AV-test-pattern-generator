#!/bin/bash

echo "=== Carré Animé ACTUA PARIS ==="
echo "Carré 100x100 pixels traversant l'écran à 25px/seconde (1px par frame)"

cd ~/ffmpeg-4.4.4

# Carré blanc 100x100 qui traverse l'écran horizontalement
# Position X: T*25 (avance de 25 pixels par seconde)
# Position Y: 490 à 590 (centré verticalement)
./ffmpeg -f lavfi -i "color=c=black:size=1920x1080:rate=25" \
         -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
         -filter_complex "[0:v]geq=r='if(lt(abs(X-T*25),50)*lt(abs(Y-540),50),255,0)':g='if(lt(abs(X-T*25),50)*lt(abs(Y-540),50),255,0)':b='if(lt(abs(X-T*25),50)*lt(abs(Y-540),50),255,0)'[v]" \
         -map "[v]" -map 1:a \
         -c:v v210 -pix_fmt yuv422p10le -r 25 \
         -field_order tt -flags +ilme+ildct \
         -c:a pcm_s16le -ar 48000 -ac 2 \
         -f decklink -s 1920x1080 \
         "UltraStudio Mini Monitor"