// ==========================================
// INICIALIZACIÓN Y CARGA DE DATOS DE LA TIENDA
// ==========================================

async function arrancarAplicacionCliente() {
    if (usuarioSesion && document.getElementById('lbl-nombre-usuario')) {
        document.getElementById('lbl-nombre-usuario').innerText = usuarioSesion.nombre;
    }
    verificarSiEsAdminOculto();
    await cargarConfiguracionTienda();
    await cargarTodasCategoriasNav();
    await consultarCatalogoProductos();
    await sincronizarImagenesYStockDesdeBD();
    actualizarInterfazCarritoCompleta();
    registrarVisitaAutomatica();
}

async function cargarTodasCategoriasNav() {
    try {
        const { data: categorias } = await supabaseClient
            .from('categorias')
            .select('*')
            .order('id_categorias', { ascending: true });
            
        const barra = document.getElementById('barra-categorias-dinamica');

        if (categorias && barra) {
            barra.innerHTML = '<a class="item-nav-categoria active" id="btn-cat-todos" onclick="volverAlCatalogo(); filtrarPorCategoria(null, this)">Inicio</a>';
            const botonesFijos = [
                { clave: 'audifono', titulo: 'Audifonos', icono: 'bi-headset' },
                { clave: 'usb', titulo: 'USB', icono: 'bi-usb-drive' },
                { clave: 'foco', titulo: 'Focos', icono: 'bi-lightbulb' },
                { clave: 'cargador', titulo: 'Cargadores', icono: 'bi-plug' }
            ];

            botonesFijos.forEach(req => {
                const catDB = categorias.find(c => c.nombre_categoria.toLowerCase().includes(req.clave));
                if (catDB) {
                    barra.innerHTML += `<a class="item-nav-categoria" onclick="filtrarPorCategoria(${catDB.id_categorias}, this)"><i class="bi ${req.icono}" style="margin-right: 6px; font-size: 1.1rem;"></i>${req.titulo}</a>`;
                } else {
                    barra.innerHTML += `<a class="item-nav-categoria" onclick="mostrarAlerta('Aviso', 'Esta categoría aún no tiene productos registrados.')"><i class="bi ${req.icono}" style="margin-right: 6px; font-size: 1.1rem;"></i>${req.titulo}</a>`;
                }
            });

            let dropdownHTML = `<div class="desplegable-categorias-hover"><a class="item-nav-categoria" style="cursor: pointer;">Mas Categorias <i class="bi bi-plus-lg" style="margin-left: 4px; font-weight: bold;"></i></a><div class="contenido-desplegable-categorias">`;
            categorias.forEach(cat => {
                const nombreLimpio = cat.nombre_categoria.replace(/^\d+\.\s*/, '');
                dropdownHTML += `<div class="item-categoria-desplegable" onclick="volverAlCatalogo(); filtrarPorCategoria(${cat.id_categorias}, null)">${nombreLimpio}</div>`;
            });
            dropdownHTML += `</div></div>`;
            barra.innerHTML += dropdownHTML;
        }
    } catch (e) {
        console.error("Error cargando categorías:", e);
    }
}

async function cargarConfiguracionTienda() {
    try {
        const { data } = await supabaseClient.from('configuracion').select('*').eq('id_config', 1).single();
        if (data) {
            if (data.minimo_mayoreo) {
                minimoMayoreoGlobal = parseInt(data.minimo_mayoreo);
            }

            const aviso = document.getElementById('banner-aviso-tienda');
            if (aviso) aviso.innerHTML = `${data.aviso_tienda || 'Venta mayoreo y menudeo'}<br><span style="font-weight: normal; font-size: 0.95rem;">Mayoreo a partir de ${data.minimo_mayoreo || 6} piezas iguales o diferentes</span>`;

            const lugar = document.getElementById('foot-lugar'); if (lugar) lugar.innerText = data.direccion || '...';
            const tel = document.getElementById('foot-tel'); if (tel) tel.innerHTML = '<i class="bi bi-telephone-fill" style="margin-right: 8px;"></i>' + (data.telefono_contacto || '...');
            const correo = document.getElementById('foot-correo'); if (correo) correo.innerHTML = '<i class="bi bi-envelope-fill" style="margin-right: 8px;"></i>' + (data.correo_contacto || '...');
            const hor = document.getElementById('foot-horarios'); if (hor) hor.innerText = data.horarios || '...';
            const desc = document.getElementById('foot-descripcion'); if (desc) desc.innerText = data.texto_footer || '...';
            const fb = document.getElementById('foot-fb-link'); if (fb && data.facebook) fb.href = data.facebook;
        }
    } catch (e) { }
}

async function consultarCatalogoProductos() {
    try {
        const { data } = await supabaseClient.from('productos').select('*').order('id_productos', { ascending: false });
        listaProductosGlobal = data || [];
        pintarCatalogoEnGrid(listaProductosGlobal);
    } catch (err) { }
}

function pintarCatalogoEnGrid(productosAMostrar) {
    const grid = document.getElementById('contenedor-grid-catalogo');
    if (!grid) return;
    let tarjetasHTML = '';
    productosAMostrar.forEach(p => { tarjetasHTML += generarTarjetaProducto(p); });
    grid.innerHTML = tarjetasHTML;
}

function generarTarjetaProducto(p) {
    const urlImagen = obtenerImagenPrincipal(p.imagen, 'https://via.placeholder.com/300x200?text=+');
    return `
        <div class="tarjeta-producto" style="cursor: pointer;" onclick="verDetallesProductoSPA(${p.id_productos})">
            <div class="tarjeta-producto-contenedor-img"><img src="${urlImagen}" alt="${p.nombre}" class="tarjeta-producto-img"></div>
            <div class="tarjeta-producto-titulo">${p.nombre}</div>
            <div style="display: flex; justify-content: space-around; font-size: 0.85rem; margin-bottom: 15px; text-align: center;">
                <div><div style="color: #000; font-weight: bold; margin-bottom: 2px;">Precio Menudeo</div><div style="color: #ef4444; font-weight: bold;">${formatoMoneda(p.precio_menudeo)}</div></div>
                <div><div style="color: #000; font-weight: bold; margin-bottom: 2px;">Precio Mayoreo</div><div style="color: #ef4444; font-weight: bold;">${formatoMoneda(p.precio_mayoreo)}</div></div>
            </div>
            <button class="boton-accion-tarjeta" onclick="event.stopPropagation(); procesarEnvioAlCarrito(${p.id_productos})">Comprar Ahora</button>
        </div>
    `;
}

// ==========================================
// VISTA DETALLE DEL PRODUCTO (SPA)
// ==========================================

function verDetallesProductoSPA(id) {
    const productoSeleccionado = listaProductosGlobal.find(producto => producto.id_productos === id);
    if (!productoSeleccionado) return;
    productoViendoActualmente = productoSeleccionado;

    const vistaCatalogo = document.getElementById('vista-catalogo'); 
    if (vistaCatalogo) vistaCatalogo.style.display = 'none';
    
    const vistaProducto = document.getElementById('vista-producto'); 
    if (vistaProducto) vistaProducto.style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Información general
    document.getElementById('prod-title').innerText = productoSeleccionado.nombre;
    document.getElementById('prod-brand').innerText = productoSeleccionado.marca || 'Genérico';
    document.getElementById('prod-menudeo').innerText = formatoMoneda(productoSeleccionado.precio_menudeo);
    document.getElementById('prod-mayoreo').innerText = formatoMoneda(productoSeleccionado.precio_mayoreo);
    document.getElementById('prod-desc').innerText = productoSeleccionado.descripcion || 'Sin descripción adicional.';

    // Procesamiento de múltiples imágenes (cadenas separadas por comas)
    const urls = productoSeleccionado.imagen 
        ? productoSeleccionado.imagen.split(',').map(u => u.trim()).filter(u => u !== "") 
        : [];
    const mainUrl = urls.length > 0 ? urls[0] : 'https://via.placeholder.com/300x300?text=Sin+Imagen';
    
    const mainImgEl = document.getElementById('prod-main-img');
    if (mainImgEl) mainImgEl.src = mainUrl;

    // Miniaturas dinámicas
    const containerThumbnails = document.getElementById('prod-thumbnails');
    if (containerThumbnails) {
        if (urls.length > 1) {
            let thumbHTML = '';
            urls.forEach((url, idx) => {
                const activeClass = idx === 0 ? 'class="activa"' : '';
                thumbHTML += `
                    <img src="${url}" ${activeClass} 
                         onclick="
                             document.getElementById('prod-main-img').src='${url}'; 
                             document.querySelectorAll('#prod-thumbnails img').forEach(img => img.classList.remove('activa')); 
                             this.classList.add('activa');
                         ">`;
            });
            containerThumbnails.innerHTML = thumbHTML;
            containerThumbnails.style.display = 'flex';
        } else {
            containerThumbnails.innerHTML = '';
            containerThumbnails.style.display = 'none';
        }
    }

    // Manejo de Stock y Cantidad
    const stockBadge = document.getElementById('prod-stock-status');
    const qtyInput = document.getElementById('prod-qty');
    if (qtyInput) qtyInput.value = 1;

    if (stockBadge && qtyInput) {
        if (productoSeleccionado.stock > 0) {
            stockBadge.innerText = `Disponible (Quedan ${productoSeleccionado.stock})`;
            stockBadge.className = 'etiqueta-estado-stock';
            qtyInput.max = productoSeleccionado.stock;
        } else {
            stockBadge.innerText = `Agotado por el momento`;
            stockBadge.className = 'etiqueta-estado-stock agotado';
            qtyInput.max = 0;
            qtyInput.value = 0;
        }
    }

    // Productos Similares
    const productosSimilares = listaProductosGlobal
        .filter(p => p.id_categorias === productoSeleccionado.id_categorias && p.id_productos !== productoSeleccionado.id_productos)
        .slice(0, 4);
    
    const contenedorSimilares = document.getElementById('prod-similares');
    if (contenedorSimilares) {
        if (productosSimilares.length === 0) {
            contenedorSimilares.innerHTML = '<div style="color: #64748b; font-style: italic;">No hay productos similares en esta categoría.</div>';
        } else {
            let similaresHTML = '';
            productosSimilares.forEach(similar => {
                const imgSimilar = similar.imagen 
                    ? similar.imagen.split(',')[0].trim() 
                    : 'https://via.placeholder.com/150';
                similaresHTML += `
                    <div class="tarjeta-similar" onclick="verDetallesProductoSPA(${similar.id_productos})">
                        <div class="tarjeta-similar-img"><img src="${imgSimilar}"></div>
                        <div class="tarjeta-similar-titulo">${similar.nombre}</div>
                        <div class="tarjeta-similar-precio">Precio Menudeo <span style="color:#000;">${formatoMoneda(similar.precio_menudeo)}</span></div>
                        <div class="tarjeta-similar-mayoreo">Precio Mayoreo <span>${formatoMoneda(similar.precio_mayoreo)}</span></div>
                    </div>`;
            });
            contenedorSimilares.innerHTML = similaresHTML;
        }
    }
}

function volverAlCatalogo() {
    const vistaProd = document.getElementById('vista-producto'); if (vistaProd) vistaProd.style.display = 'none';
    const vistaCat = document.getElementById('vista-catalogo'); if (vistaCat) vistaCat.style.display = 'block';
    productoViendoActualmente = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filtrarPorCategoria(idCat, elemento) {
    volverAlCatalogo();
    document.querySelectorAll('.item-nav-categoria').forEach(i => i.classList.remove('active'));
    if (elemento) elemento.classList.add('active');
    if (idCat === null) pintarCatalogoEnGrid(listaProductosGlobal);
    else pintarCatalogoEnGrid(listaProductosGlobal.filter(p => p.id_categorias === idCat));
}

function buscarProducto() {
    volverAlCatalogo();
    const txt = document.getElementById('input-buscador').value.trim().toLowerCase();
    pintarCatalogoEnGrid(listaProductosGlobal.filter(p => p.nombre.toLowerCase().includes(txt)));
}

// ==========================================
// CARRITO Y ACCIONES
// ==========================================

async function agregarAlCarritoDesdeDetalle() {
    if (!productoViendoActualmente) return;
    const cant = parseInt(document.getElementById('prod-qty').value);
    if (isNaN(cant) || cant <= 0) return;
    if (productoViendoActualmente.stock < cant) {
        await mostrarAlerta("Atención", `Solo quedan ${productoViendoActualmente.stock} piezas disponibles.`);
        return;
    }

    let existente = carritoItems.find(c => c.id_productos === productoViendoActualmente.id_productos);
    if (existente) {
        if (existente.cantidad + cant > productoViendoActualmente.stock) {
            await mostrarAlerta("Atención", `No puedes agregar más. Solo quedan ${productoViendoActualmente.stock} piezas en total.`);
            return;
        }
        existente.cantidad += cant;
    } else {
        carritoItems.push({
            id_productos: productoViendoActualmente.id_productos,
            nombre: productoViendoActualmente.nombre,
            precio_menudeo: productoViendoActualmente.precio_menudeo,
            precio_mayoreo: productoViendoActualmente.precio_mayoreo,
            stock_limite: productoViendoActualmente.stock,
            imagen: productoViendoActualmente.imagen,
            cantidad: cant
        });
    }
    localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
    actualizarInterfazCarritoCompleta();

    const floatCart = document.getElementById('preview-flotante-carrito');
    if (floatCart) {
        floatCart.style.display = 'flex';
        setTimeout(() => { floatCart.style.display = 'none'; }, 2500);
    }
}

async function comprarAhoraDirecto() {
    if (!productoViendoActualmente || productoViendoActualmente.stock <= 0) {
        await mostrarAlerta("Atención", "Producto agotado.");
        return;
    }
    await agregarAlCarritoDesdeDetalle();
    window.location.href = "carrito.html";
}

async function registrarVisitaAutomatica() {
    if (usuarioSesion && usuarioSesion.rol === 'admin') return;

    try {
        const fechaActual = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' });

        const { data: visitaHoy } = await supabaseClient
            .from('visitas')
            .select('*')
            .eq('fecha', fechaActual)
            .maybeSingle();

        if (visitaHoy) {
            await supabaseClient
                .from('visitas')
                .update({ cantidad: visitaHoy.cantidad + 1 })
                .eq('id_visitas', visitaHoy.id_visitas);
        } else {
            await supabaseClient
                .from('visitas')
                .insert([{ fecha: fechaActual, cantidad: 1 }]);
        }
    } catch (error) {
        console.error("Error registrando visita:", error);
    }
}

// ==========================================
// SUBIDA DE ARCHIVOS Y GUARDADO EN SUPABASE
// ==========================================

// Helper para convertir cadenas Base64/DataURL a Blob
function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

async function guardarProducto() {
    const inputImagen = document.getElementById('tu-input-file');
    if (!inputImagen || !inputImagen.files[0]) {
        alert("Por favor selecciona una imagen primero.");
        return;
    }

    const archivoOriginal = inputImagen.files[0];
    const nombreArchivo = `${Date.now()}_0_prod_edit.webp`;

    // 1. Subir la imagen al bucket 'imagenes'
    const { data: storageData, error: storageError } = await supabaseClient
        .storage
        .from('imagenes')
        .upload(nombreArchivo, archivoOriginal, {
            contentType: 'image/webp',
            upsert: true
        });

    if (storageError) {
        console.error('Error detallado al subir imagen a Supabase Storage:', storageError.message, storageError);
        alert('Error al subir la imagen: ' + storageError.message);
        return;
    }

    // 2. Obtener la URL pública de la imagen recien subida
    const { data: urlData } = supabaseClient
        .storage
        .from('imagenes')
        .getPublicUrl(nombreArchivo);

    const urlPublicaImagen = urlData.publicUrl;

    // 3. Insertar el registro en la base de datos (tabla 'productos')
    const { data, error: dbError } = await supabaseClient
        .from('productos')
        .insert([
            {
                nombre: document.getElementById('input-nombre') ? document.getElementById('input-nombre').value : '',
                precio_menudeo: parseFloat(document.getElementById('input-precio-menudeo')?.value || 0),
                precio_mayoreo: parseFloat(document.getElementById('input-precio-mayoreo')?.value || 0),
                stock: parseInt(document.getElementById('input-stock')?.value || 0),
                imagen: urlPublicaImagen
            }
        ]);

    if (dbError) {
        console.error('Error al guardar el producto en BD:', dbError.message);
        alert('Error al registrar el producto: ' + dbError.message);
    } else {
        alert('¡Producto guardado exitosamente!');
        await consultarCatalogoProductos();
    }
}

async function cargarTotalVisitasEnAdmin() {
    try {
        // Consulta todos los registros de la tabla 'visitas'
        const { data, error } = await supabaseClient
            .from('visitas')
            .select('cantidad');

        if (error) {
            console.error("Error al consultar visitas:", error);
            return;
        }

        // Suma las visitas de todos los días registrados
        const totalVisitas = data.reduce((acum, fila) => acum + (fila.cantidad || 0), 0);

        // Actualiza el elemento en el HTML
        const lblVisitas = document.getElementById('count-visitas');
        if (lblVisitas) {
            lblVisitas.innerText = totalVisitas;
        }
    } catch (err) {
        console.error("Error cargando estadísticas en admin:", err);
    }
}