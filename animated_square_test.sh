#!/bin/bash

# Générateur de carré animé traversant l'écran
# Vitesse: 1 pixel par frame à 25fps

echo "=== Générateur Carré Animé ACTUA PARIS ==="

# Variables
DEVICE="UltraStudio Mini Monitor"
SIZE="1920x1080"
RATE="25"
SQUARE_SIZE="100"

echo "Carré ${SQUARE_SIZE}x${SQUARE_SIZE}px traversant l'écran en ${RATE}fps"
echo "Vitesse: 1 pixel par frame"

# Formule mathématique pour animation:
# X position = mod(t*25, 1920) - position se répète toutes les 1920/25 = 76.8 secondes
# Y position = 490 (centré verticalement)

cd ~/ffmpeg-4.4.4

echo "Lancement du carré animé..."

./ffmpeg -f lavfi -i "color=c=black:size=${SIZE}:rate=${RATE}" \
         -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
         -filter_complex "[0:v]geq=r=if(gte(X-mod(t*25\\\\,1920)\\\\,0)*gte(mod(t*25\\\\,1920)+100-X\\\\,0)*gte(Y-490\\\\,0)*gte(590-Y\\\\,0)\\\\,255\\\\,0):g=if(gte(X-mod(t*25\\\\,1920)\\\\,0)*gte(mod(t*25\\\\,1920)+100-X\\\\,0)*gte(Y-490\\\\,0)*gte(590-Y\\\\,0)\\\\,255\\\\,0):b=if(gte(X-mod(t*25\\\\,1920)\\\\,0)*gte(mod(t*25\\\\,1920)+100-X\\\\,0)*gte(Y-490\\\\,0)*gte(590-Y\\\\,0)\\\\,255\\\\,0)[v]" \
         -map "[v]" -map 1:a \
         -c:v v210 -pix_fmt yuv422p10le -r ${RATE} \
         -field_order tt -flags +ilme+ildct \
         -c:a pcm_s16le -ar 48000 -ac 2 \
         -f decklink -s ${SIZE} \
         "${DEVICE}"