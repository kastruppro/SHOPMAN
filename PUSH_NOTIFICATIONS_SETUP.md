# Push Notifikationer - Opsætning

Denne guide beskriver hvordan du færdiggør push notifikationer til SHOPMAN.

## Hvad er allerede implementeret

### Frontend (færdigt)
- ✅ Service Worker med push event handler
- ✅ Notification click handler (åbner specifik liste)
- ✅ IndexedDB lagring af subscription per liste
- ✅ UI toggle til at aktivere/deaktivere notifikationer per liste
- ✅ "Følg liste" funktion med offline adgang

### Backend (mangler)
For at push notifikationer virker, skal du implementere følgende på din Supabase backend:

## Trin 1: Generér VAPID nøgler

VAPID (Voluntary Application Server Identification) nøgler bruges til at identificere din server.

```bash
# Installer web-push værktøj
npm install -g web-push

# Generér nøgler
web-push generate-vapid-keys
```

Du får output som:
```
Public Key: BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

## Trin 2: Tilføj public key til frontend

Opdater `js/components/listpage.js` og erstat placeholder med din public key:

```javascript
const VAPID_PUBLIC_KEY = 'DIN_PUBLIC_KEY_HER';
```

Find denne linje i `subscribeToNotifications()` funktionen.

## Trin 3: Opret Supabase Edge Function

Opret en ny Edge Function til at sende push notifikationer:

```bash
supabase functions new send-push-notification
```

### Edge Function kode (`supabase/functions/send-push-notification/index.ts`):

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_SUBJECT = 'mailto:din@email.dk'

serve(async (req) => {
  const { subscription, title, body, listId, listName } = await req.json()

  // Web Push kræver crypto libraries - brug f.eks. web-push npm pakke
  // eller implementer manuelt med Deno crypto

  const payload = JSON.stringify({
    title,
    body,
    data: {
      listId,
      listName,
      url: `/#list/${encodeURIComponent(listName)}`
    }
  })

  // Send push notification
  // ... implementer web-push logik her

  return new Response(JSON.stringify({ success: true }))
})
```

## Trin 4: Gem subscriptions i database

Opret en tabel til at gemme push subscriptions:

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, endpoint)
);
```

## Trin 5: Opdater API til at gemme subscription

Tilføj endpoint til at gemme subscription når bruger aktiverer notifikationer:

```javascript
// I din Supabase backend
app.post('/api/subscribe/:listId', async (req, res) => {
  const { listId } = req.params
  const subscription = req.body

  await supabase
    .from('push_subscriptions')
    .upsert({
      list_id: listId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    })

  res.json({ success: true })
})
```

## Trin 6: Trigger notifikationer ved ændringer

Brug Supabase Realtime eller Database Triggers til at sende notifikationer:

```sql
-- Database trigger eksempel
CREATE OR REPLACE FUNCTION notify_list_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Kald Edge Function til at sende push notifications
  PERFORM net.http_post(
    url := 'https://din-project.supabase.co/functions/v1/send-push-notification',
    body := json_build_object(
      'listId', NEW.list_id,
      'action', TG_OP
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION notify_list_change();
```

## Trin 7: Sæt miljøvariabler

I Supabase dashboard, tilføj secrets:

```
VAPID_PUBLIC_KEY=din_public_key
VAPID_PRIVATE_KEY=din_private_key
```

## Test

1. Åbn appen i en browser der understøtter push (Chrome, Firefox, Edge)
2. Følg en liste og aktiver notifikationer
3. Åbn listen i et andet vindue og tilføj/ændr en vare
4. Du bør modtage en push notifikation

## Bemærkninger

- **iOS Safari**: Push notifikationer kræver iOS 16.4+ og at appen er installeret på homescreen
- **Permissions**: Brugeren skal give tilladelse til notifikationer
- **HTTPS**: Push notifikationer virker kun over HTTPS (eller localhost)

## Alternativ: Firebase Cloud Messaging (FCM)

Hvis du foretrækker Firebase, kan du bruge FCM i stedet for web-push:

1. Opret Firebase projekt
2. Tilføj Firebase config til frontend
3. Brug FCM SDK til subscriptions
4. Send notifikationer via Firebase Admin SDK

---

## Nuværende features (færdige)

### Følg liste
- Brugere kan følge lister for offline adgang
- Fulgte lister vises på forsiden under "Mine lister"
- Data caches lokalt i IndexedDB

### Gem adgangskode
- Når man logger ind på en beskyttet liste, kan man vælge "Husk adgangskode"
- Næste gang åbnes listen automatisk uden password prompt
- Adgangskoder gemmes lokalt (base64 encoded)

### Kategori emojis
- Hver kategori har nu et emoji ikon i listevisningen:
  - 🥬 Frugt & grønt
  - 🧀 Mejeri
  - 🥩 Kød
  - 🥖 Bageri
  - 🧊 Frost
  - 🥫 Kolonial
  - 🥤 Drikkevarer
  - 🍿 Snacks
  - 🧹 Husholdning
  - 🧴 Personlig pleje
  - 📦 Andet
  - 📝 Uden kategori
