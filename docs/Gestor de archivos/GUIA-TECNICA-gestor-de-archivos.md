1. Qué debe tener listo el front

Antes de abrir Picker, el frontend necesita:

Google API script cargado en la página.
API key para Picker.
OAuth client ID configurado en Google Cloud.
Saber si la cuenta ya está conectada llamando a tu backend:
GET /api/integrations/google-drive/status
Si no está conectada:
llamar GET /api/integrations/google-drive/oauth/start
redirigir al usuario a authorizationUrl
esperar el callback backend-first y volver a tu app.
Google indica que Picker en web usa JavaScript y que el flujo OAuth para apps web con backend debe implementarse con el flow de web server applications.
2. Qué NO debe hacer el front

El frontend no debe:

pedirle al usuario un fileId
usar el state para lógica de negocio
intercambiar code por tokens
guardar access tokens de Google del flujo backend-first

El front solo debe:

iniciar conexión
abrir Picker
recibir el archivo elegido
mandar fileId a tu backend para importar

Eso mantiene el backend como autoridad del flujo OAuth y de la importación.

3. Flujo UX recomendado en front
Estado 1: no conectado

Cuando el usuario entra a Importar → Google Drive:

Llama GET /api/integrations/google-drive/status
Si connected = false, muestra:
Conectar Google Drive
Al hacer clic:
llama GET /api/integrations/google-drive/oauth/start
redirige a authorizationUrl
Estado 2: conectado

Cuando vuelve a tu app:

Vuelves a llamar GET /api/integrations/google-drive/status
Si connected = true, abres Google Picker
Cuando el usuario elige un archivo:
obtienes fileId
llamas POST /api/integrations/google-drive/import

Ese flujo coincide con la función de Picker como selector visual de archivos de Drive y con el uso del backend para manejar tokens y acceso a la API.

4. Cargar las librerías necesarias

En el front debes cargar el script de Google APIs, porque Picker depende de eso. La documentación de Picker para web lo trata como una API JavaScript para apps web.

Ejemplo en index.html:

<script async defer src="https://apis.google.com/js/api.js"></script>

Luego, en tu componente o servicio frontend, esperas a que cargue y cargas el módulo picker.

Ejemplo conceptual:

declare const gapi: any;
declare const google: any;

function loadGooglePickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window['gapi']) {
      reject(new Error('gapi no está cargado'));
      return;
    }

    gapi.load('picker', {
      callback: () => resolve(),
      onerror: () => reject(new Error('No se pudo cargar Google Picker')),
    });
  });
}
5. Qué necesita el front para abrir Picker

Para construir Picker normalmente necesitas:

developer key → tu API key
OAuth token del usuario
appId o project number en algunos escenarios
la vista que quieres mostrar (DocsView, etc.)

Aquí hay un punto importante: la documentación y ejemplos de Picker para web muestran que Picker usa el token OAuth del usuario con setOAuthToken, y el ejemplo oficial lo trata como parte central del builder.

6. La decisión importante en tu arquitectura

Como tu flujo es backend-first, tienes dos opciones para el front:

Opción A — más simple de integrar con Picker

Tu backend expone un endpoint para entregar al frontend un access token válido para Picker después de que la cuenta ya está conectada.

Ejemplo:

GET /api/integrations/google-drive/picker-token

Respuesta:

{
  "data": {
    "oauthToken": "<token-google-vigente>"
  }
}

Luego el front usa ese token solo para abrir Picker.
Después, la importación real sigue yendo por backend con POST /import.

Opción B — construir una lista propia

No usas Picker y haces tu explorador propio con backend.
No la recomiendo si tu objetivo es mejor UX.

Para una experiencia realmente buena con Picker, la opción A encaja mejor.

7. Cómo abrir Google Picker desde el front

Una vez que:

el usuario ya está conectado
cargaste gapi.load('picker')
tienes oauthToken
tienes tu apiKey

puedes abrir Picker así:

declare const google: any;

type PickedFile = {
  id: string;
  name?: string;
  mimeType?: string;
};

function openGooglePicker(params: {
  apiKey: string;
  oauthToken: string;
  onPicked: (file: PickedFile) => void;
  onCancel?: () => void;
}) {
  const view = new google.picker.DocsView()
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const picker = new google.picker.PickerBuilder()
    .setDeveloperKey(params.apiKey)
    .setOAuthToken(params.oauthToken)
    .addView(view)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs?.[0];
        if (!doc) return;

        params.onPicked({
          id: doc.id,
          name: doc.name,
          mimeType: doc.mimeType,
        });
      }

      if (data.action === google.picker.Action.CANCEL && params.onCancel) {
        params.onCancel();
      }
    })
    .build();

  picker.setVisible(true);
}

Google muestra en su documentación y ejemplo oficial que Picker se construye con PickerBuilder, vistas como DocsView, y un callback que recibe la selección del usuario.

8. Qué hace el front cuando el usuario elige un archivo

Cuando Picker devuelve el archivo, el front no lo descarga ni lo sube por su cuenta.
Solo toma el fileId y llama a tu backend:

async function importFromGoogleDrive(fileId: string, name?: string, tags?: string[]) {
  const response = await fetch('/api/integrations/google-drive/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({
      fileId,
      name,
      tags: tags ?? [],
    }),
  });

  if (!response.ok) {
    throw new Error('No se pudo importar el archivo desde Google Drive');
  }

  return response.json();
}

Ese backend ya es quien:

valida conexión activa
usa o refresca token
consulta metadata
descarga
guarda en storage interno
crea ComposerMedia
9. Instrucciones exactas para el equipo frontend

Yo se las dejaría así:

Front: pasos obligatorios
Cargar https://apis.google.com/js/api.js
Implementar servicio GooglePickerService
Antes de abrir Picker, consultar:
GET /api/integrations/google-drive/status
Si no está conectado:
llamar GET /api/integrations/google-drive/oauth/start
redirigir a authorizationUrl
Al volver a la app:
refrescar status
Si está conectado:
llamar GET /api/integrations/google-drive/picker-token
cargar módulo picker
abrir PickerBuilder
Cuando el usuario elija archivo:
tomar fileId
llamar POST /api/integrations/google-drive/import
Mostrar confirmación:
Archivo importado correctamente
10. Recomendación de UX

Cuando el callback OAuth termine, no dejes al usuario “en el gestor” sin más.
Haz esto:

mostrar toast: Google Drive conectado
abrir Picker automáticamente
tras seleccionar archivo, llamar import
mostrar toast: Archivo importado correctamente

Eso aprovecha mejor la intención del usuario: no quería “conectar”, quería traer un archivo.

11. Lo que falta en tu backend para que Picker quede redondo

Si vas por esta arquitectura, te sugiero agregar este endpoint:

GET /api/integrations/google-drive/picker-token

Porque sin eso, el front no tiene una forma limpia de conseguir el token OAuth que Picker necesita para abrir la ventana de selección. Los ejemplos oficiales de Picker usan un OAuth token del usuario en el builder.

12. Resumen corto para el front

Las instrucciones al front son:

no pedir fileId al usuario
sí abrir Google Picker
obtener fileId desde Picker
mandar fileId al backend
dejar que el backend haga toda la importación

Si quieres, te puedo dejar esto ya aterrizado en Angular, con un GooglePickerService y el flujo completo status → connect → picker → import.
