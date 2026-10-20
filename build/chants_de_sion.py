#!/usr/bin/env python3
"""Premier jet de « Chants de Sion » (César Malan, édition de 1855, domaine public) à partir du
texte OCR d'Internet Archive (chantsdesionour00malagoog_djvu.txt).

Usage : python3 build/chants_de_sion.py ocr.txt vocab.txt > build/chants-de-sion.draft.json

Le script découpe le texte en cantiques et en strophes, retire les en-têtes de page et les notes,
corrige les erreurs de reconnaissance les plus fréquentes, et signale (champ « suspects ») les mots
absents du vocabulaire de référence (bibles françaises anciennes) pour la relecture humaine.
La relecture produit build/chants-de-sion.fixes.json, appliqué par build/apply_fixes.py.
"""

import json
import re
import sys
import unicodedata

ocr_path, vocab_path = sys.argv[1], sys.argv[2]
lines = open(ocr_path, encoding='utf-8').read().split('\n')
vocab = set(open(vocab_path, encoding='utf-8').read().split())

# Le recueil commence après la préface, à l'Invocation.
start = next(i for i, l in enumerate(lines) if l.strip().startswith('CHANTS DE SION.') and i > 300)
lines = lines[start:]

NUMBER = r'(\d{1,3}|[iIl]|[iIl]\d|\d[iIl])'
HYMN = re.compile(rf'^\s*{NUMBER}\s*[.,]?\s*$')
STANZA = re.compile(r'^\s*(\d{1,2}|[iIl])\s*[.,]\s+(\S.*)$')
NOTE = re.compile(r'^\s*\(\d\)|^\s*\(\*\)')
UPPER = 'A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒ'


def is_running_head(s: str) -> bool:
    t = s.strip()
    if not t:
        return False
    # « 16 I. Partie. — Objet de la foi. », « PUBLICATION DE LA BONNE-NOUVELLE. 17 »
    if re.search(r'Partie|PARTIE|PARlft|Pariie', t) and re.search(r'\d', t):
        return True
    letters = [c for c in t if c.isalpha()]
    caps = sum(1 for c in letters if c.isupper())
    if letters and caps / len(letters) > 0.8 and re.search(r'(^\d{1,3}\s)|(\s\d{1,3}\s*\.?$)', t):
        return True
    if re.match(r'^§|^S [IVX]+\.', t):
        return True
    return False


def as_number(token: str) -> int:
    return int(token.replace('i', '1').replace('I', '1').replace('l', '1'))


# Corrections sûres, appliquées partout.
FIXES = [
    (r'(?<![\wÀ-ÿ])6(?= [A-ZÀ-Ýa-zà-ÿ])', 'ô'),  # « 6 Saint-Esprit » → « ô Saint-Esprit »
    (r'€', 'C'),
    (r'(?<=\w)\^(?=\w)', 'e'),
    (r'\^', ''),
    (r'(?<=[a-zà-ÿ])1(?=[a-zà-ÿ])', 'l'),
    (r'\s+([,;:.!?])', r'\1'),
    (r'([;:!?])(?=[A-Za-zÀ-ÿ])', r'\1 '),
    (r'«\s*', '« '),
    (r'\s*»', ' »'),
    (r'\bH (?=[a-zà-ÿ])', 'Il '),
    (r'\bmôme\b', 'même'),
    (r'\bEternel\b', 'Éternel'),
    (r'\bEsprit\b', 'Esprit'),
    (r'\s{2,}', ' '),
]


def clean(line: str) -> str:
    s = line.strip().strip('*').strip()
    for pattern, repl in FIXES:
        s = re.sub(pattern, repl, s)
    # « ? » ou « 1 » en fin de vers : ponctuation mal lue, laissée à la relecture.
    return s.strip()


WORD = re.compile(rf"[{UPPER}a-zà-ÿœ]+(?:-[{UPPER}a-zà-ÿœ]+)*", re.UNICODE)


def suspects(text: str) -> list:
    out = []
    for w in WORD.findall(text):
        for part in w.split('-'):
            low = part.lower()
            low = re.sub(r"^(l|d|qu|j|m|t|s|n|c)'", '', low)
            if len(low) < 3 or low in vocab or low.capitalize() in vocab:
                continue
            out.append(part)
    return sorted(set(out))


hymns = []
current = None
stanza = None
expected = 1
for raw in lines:
    t = raw.strip()
    if not t or NOTE.match(t) or is_running_head(t):
        continue
    m = HYMN.match(t)
    if m:
        n = as_number(m.group(1))
        # Un numéro seul est un nouveau cantique s'il suit à peu près le précédent.
        if expected - 1 <= n <= expected + 3 or (current and not current['stanzas']):
            current = {'number': expected if abs(n - expected) > 3 else n, 'stanzas': [], 'before': []}
            hymns.append(current)
            expected = current['number'] + 1
            stanza = None
            continue
    if current is None:
        continue
    s = STANZA.match(t)
    if s:
        stanza = [clean(s.group(2))]
        current['stanzas'].append(stanza)
    elif stanza is not None:
        stanza.append(clean(t))
    else:
        current['before'].append(clean(t))

out = []
for h in hymns:
    stanzas = [[l for l in st if l] for st in h['stanzas'] if any(st)]
    if not stanzas:
        continue
    text = '\n'.join(l for st in stanzas for l in st)
    out.append({
        'number': h['number'],
        'subtitle': ' '.join(h['before'])[:120],
        'stanzas': stanzas,
        'suspects': suspects(text),
    })

json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
print(f'{len(out)} cantiques, {sum(len(h["suspects"]) for h in out)} mots suspects', file=sys.stderr)
