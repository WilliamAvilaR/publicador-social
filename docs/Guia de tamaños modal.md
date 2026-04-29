Tamaño
Width: 560px
Max-width: 90vw
Padding interno: 24px
Border-radius: 12px
Altura
Auto (contenido)
Max-height: 90vh
Overflow-y: auto
🧱 2. ESTRUCTURA INTERNA
[ Header ]
[ Body ]
[ Footer ]
🧭 3. HEADER
Layout
Display: flex
Align: center
Justify: space-between
Gap: 12px
Margin-bottom: 20px
Elementos
Título
Font-size: 20px
Font-weight: 600
Line-height: 28px
Subtítulo (ubicación)
Font-size: 13px
Color: #6B7280
Margin-top: 4px
Botón cerrar
Size: 32px x 32px
Icon: 16px
Border-radius: 8px
Hover: background #F3F4F6
🧩 4. BODY
Espaciado general
Display: flex
Flex-direction: column
Gap: 20px
✏️ 5. INPUT NOMBRE
Label
Font-size: 14px
Font-weight: 500
Margin-bottom: 6px
Input
Height: 44px
Padding: 0 12px
Border-radius: 8px
Border: 1px solid #D1D5DB
Font-size: 14px
Estados
Focus
Border: #2563EB
Box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15)
Error
Border: #EF4444
Helper text
Font-size: 12px
Color: #6B7280
Margin-top: 4px
🎨 6. SELECTOR DE COLOR
Contenedor
Display: grid
Grid-template-columns: repeat(8, 1fr)
Gap: 10px
Color item
Size: 36px x 36px
Border-radius: 8px
Cursor: pointer
Estado seleccionado
Border: 2px solid #2563EB
Inner icon: ✓ (16px)
Hover
Transform: scale(1.05)
➕ 7. COLOR PERSONALIZADO
Contenedor
Display: flex
Align: center
Gap: 10px
Margin-top: 8px
Color preview
Size: 28px x 28px
Border-radius: 6px
Border: 1px solid #D1D5DB
Input HEX
Height: 36px
Width: 140px
Padding: 0 10px
Font-size: 13px
Border-radius: 6px
👁️ 8. PREVIEW
Contenedor
Display: flex
Align: center
Gap: 12px
Padding: 12px
Border: 1px solid #E5E7EB
Border-radius: 10px
Background: #F9FAFB
Icono carpeta
Size: 40px x 40px
Texto
Font-size: 14px
Font-weight: 500
🧾 9. FOOTER
Layout
Display: flex
Justify: flex-end
Gap: 12px
Margin-top: 8px
🔘 10. BOTONES
Cancelar
Height: 40px
Padding: 0 16px
Border-radius: 8px
Background: transparent
Border: 1px solid #D1D5DB
Font-size: 14px
Guardar
Height: 40px
Padding: 0 18px
Border-radius: 8px
Background: #2563EB
Color: white
Font-size: 14px
Font-weight: 500
Disabled
Background: #93C5FD
Cursor: not-allowed
Loading
Spinner + "Guardando..."
📏 11. ESPACIADOS CLAVE
Header → Body: 20px
Secciones internas: 20px
Label → Input: 6px
Input → helper: 4px
Grid colores: gap 10px
Footer → contenido: 8px
