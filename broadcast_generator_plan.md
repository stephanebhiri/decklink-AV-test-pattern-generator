# ACTUA PARIS - Générateur Broadcast Professionnel

## Architecture Web

### Frontend (Interface Web)
- **Framework**: React.js ou Vue.js
- **Interface**: Drag & Drop pour éléments graphiques
- **Contrôles temps réel**: WebSocket vers backend
- **Preview**: Canvas HTML5 pour preview temps réel

### Backend API (Node.js/Python)
- **API REST**: Configuration des mires
- **WebSocket**: Contrôle temps réel FFmpeg
- **Queue Manager**: Gestion des tâches de rendu
- **File Manager**: Templates et assets

### Générateur FFmpeg
- **Core**: FFmpeg compilé avec toutes les libs
- **Templates**: Modèles de mires prédéfinis
- **Real-time**: Stream direct vers DeckLink
- **Export**: Fichiers vidéo pour archivage

## Fonctionnalités Interface

### Surimpression des réglages
- Option d'affichage en surimpression résumant les réglages vidéo/audio actifs (format, texte, niveaux, flash 1 image/cycle, etc.)

### 1. Texte Dynamique
```
- Police personnalisable
- Couleur, taille, position
- Animation: défilement, clignotement
- Multi-langues, caractères spéciaux
```

### 2. Motifs et Formes
```
- Carrés, cercles, barres
- Patterns de test (colorbars, grille)
- Animations: rotation, translation, zoom
- Vitesse configurable (px/frame)
```

### 3. Formats de Sortie
```
- 1080i50 (broadcast EU)
- 1080i60 (broadcast US/JP)
- 1080p25/30/50/60
- 720p50/60
- 4K formats
- Formats SD legacy
```

### 4. Audio
```
- Tons de test: 1kHz, 2kHz, sweep
- Niveaux: -20dB, -12dB, 0dB
- Stéréo/Mono/5.1
- Silence ou bruit rose
```

## Structure Technique

### Database Schema
```sql
-- Templates de mires
CREATE TABLE templates (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    config JSON,
    preview_image BLOB
);

-- Configurations utilisateur
CREATE TABLE configs (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    format VARCHAR(20),  -- "1080i50", "720p60", etc
    text_config JSON,
    motion_config JSON,
    audio_config JSON
);
```

### FFmpeg Command Builder
```javascript
class FFmpegGenerator {
    constructor(config) {
        this.format = config.format;
        this.text = config.text;
        this.motion = config.motion;
        this.audio = config.audio;
    }

    buildCommand() {
        let cmd = "ffmpeg";

        // Sources vidéo
        cmd += this.buildVideoSource();

        // Sources audio
        cmd += this.buildAudioSource();

        // Filtres complexes
        cmd += this.buildFilters();

        // Sortie DeckLink
        cmd += this.buildOutput();

        return cmd;
    }

    buildVideoSource() {
        // Base: couleur ou pattern
        // Texte: drawtext avec police/position
        // Motion: geq pour animations
    }
}
```

## Exemples de Commandes Générées

### Texte "ACTUA PARIS" défilant
```bash
ffmpeg -f lavfi -i "color=c=blue:size=1920x1080:rate=25" \\
       -filter_complex "[0:v]drawtext=text='ACTUA PARIS':fontfile=/System/Library/Fonts/Arial.ttf:fontsize=80:fontcolor=white:x=w-mod(t*50\\,w+200):y=h/2" \\
       -c:v v210 -r 25 -field_order tt -flags +ilme+ildct \\
       -f decklink "UltraStudio Mini Monitor"
```

### Carré traversant l'écran (1px/frame)
```bash
ffmpeg -f lavfi -i "color=c=black:size=1920x1080:rate=25" \\
       -filter_complex "[0:v]geq=r='if(between(X\\,mod(t*25\\,1920)\\,mod(t*25\\,1920)+100)*between(Y\\,490\\,590)\\, 255\\, 0)'" \\
       -c:v v210 -r 25 -field_order tt -flags +ilme+ildct \\
       -f decklink "UltraStudio Mini Monitor"
```

## Roadmap Développement

### Phase 1: Core FFmpeg ✅
- [x] Compilation FFmpeg + DeckLink
- [ ] Recompilation avec text support
- [ ] Tests animations basiques

### Phase 2: Backend API
- [ ] API REST configuration mires
- [ ] WebSocket contrôle temps réel
- [ ] Générateur commandes FFmpeg

### Phase 3: Frontend Web
- [ ] Interface configuration texte
- [ ] Contrôles animation/mouvement
- [ ] Sélecteur formats de sortie
- [ ] Preview temps réel

### Phase 4: Production
- [ ] Templates prédéfinis broadcast
- [ ] Gestion utilisateurs/projets
- [ ] Export/import configurations
- [ ] Monitoring output quality

Prêt pour démarrer la phase suivante une fois FFmpeg recompilé!
