async function inicializarPantallaCarrito() {
    if (usuarioSesion && document.getElementById('lbl-nombre-usuario')) { document.getElementById('lbl-nombre-usuario').innerText = usuarioSesion.nombre; }
    actualizarBadgeHeader();
    await obtenerConfiguracionMinimoMayoreo();
    await sincronizarImagenesYStockDesdeBD();
    renderizarListaCarrito();
}

function gestionarClicCarrito() {
    const preview = document.getElementById('preview-flotante-carrito');
    if (preview) preview.style.display = (preview.style.display === 'flex') ? 'none' : 'flex';
    const userMenu = document.getElementById('dropdown-menu-usuario');
    if (userMenu) userMenu.style.display = 'none';
}

async function procesarEnvioAlCarrito(id) {
    const itemOriginal = listaProductosGlobal.find(p => p.id_productos === id);
    if (!itemOriginal || itemOriginal.stock <= 0) return;

    let existente = carritoItems.find(c => c.id_productos === id);
    if (existente) {
        if (existente.cantidad >= itemOriginal.stock) {
            await mostrarAlerta("Atención", `¡Lo sentimos! Solo quedan ${itemOriginal.stock} piezas disponibles.`);
            return;
        }
        existente.cantidad += 1;
    } else {
        carritoItems.push({
            id_productos: itemOriginal.id_productos,
            nombre: itemOriginal.nombre,
            precio_menudeo: itemOriginal.precio_menudeo,
            precio_mayoreo: itemOriginal.precio_mayoreo,
            stock_limite: itemOriginal.stock,
            imagen: itemOriginal.imagen,
            cantidad: 1
        });
    }
    localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
    actualizarInterfazCarritoCompleta();
}

function actualizarBadgeHeader() {
    const totalItems = carritoItems.reduce((acc, item) => acc + item.cantidad, 0);
    const badge = document.getElementById('cart-global-badge');
    if (badge) badge.innerText = totalItems;
}

async function obtenerConfiguracionMinimoMayoreo() {
    try {
        const { data } = await supabaseClient.from('configuracion').select('minimo_mayoreo').eq('id_config', 1).single();
        if (data && data.minimo_mayoreo) { minimoMayoreoGlobal = parseInt(data.minimo_mayoreo); }
    } catch (e) { }
}

async function sincronizarImagenesYStockDesdeBD() {
    if (carritoItems.length === 0) return;
    try {
        const ids = carritoItems.map(item => item.id_productos);
        const { data: productosBD } = await supabaseClient.from('productos').select('id_productos, imagen, stock').in('id_productos', ids);
        if (productosBD) {
            carritoItems = carritoItems.filter(item => {
                const coincidencia = productosBD.find(p => p.id_productos === item.id_productos);
                if (coincidencia) {
                    item.imagen = coincidencia.imagen;
                    item.stock_limite = coincidencia.stock;
                    return true;
                }
                return false;
            });
            localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
        }
    } catch (e) { }
}

function actualizarInterfazCarritoCompleta() {
    actualizarBadgeHeader();
    const miniLista = document.getElementById('mini-lista-carrito');
    if (!miniLista) return;
    miniLista.innerHTML = '';

    let sumaEstimada = 0;
    let sumaMenudeoTotal = 0;

    if (carritoItems.length === 0) {
        miniLista.innerHTML = `<p style="font-size:0.85rem; color:#64748b; text-align:center; padding:20px 0;">Tu carrito está vacío</p>`;
        const totalHtml = document.getElementById('mini-total-precio'); if (totalHtml) totalHtml.innerText = "$0.00";
        return;
    }

    const piezasTotales = carritoItems.reduce((acc, item) => acc + item.cantidad, 0);
    const aplicaMayoreo = piezasTotales >= minimoMayoreoGlobal;

    carritoItems.forEach(item => {
        const precioUnitario = aplicaMayoreo ? parseFloat(item.precio_mayoreo) : parseFloat(item.precio_menudeo);
        const sub = precioUnitario * item.cantidad;

        sumaEstimada += sub;
        sumaMenudeoTotal += parseFloat(item.precio_menudeo) * item.cantidad;

        miniLista.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; max-width: 65%;">
                    <div style="width: 45px; height: 45px; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: white; flex-shrink: 0; padding: 2px;"><img src="${obtenerImagenPrincipal(item.imagen)}" style="max-width: 100%; max-height: 100%; object-fit: contain;"></div>
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: #1a2430;">${item.nombre}</span>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                            <button style="background: #1a2430; color: white; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-weight:bold;" onclick="event.stopPropagation(); modificarCantidadDesdeMiniCarrito(${item.id_productos}, -1)">-</button>
                            <span style="font-size: 0.85rem; font-weight: bold; min-width: 16px; text-align: center;">${item.cantidad}</span>
                            <button style="background: #1a2430; color: white; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-weight:bold;" onclick="event.stopPropagation(); modificarCantidadDesdeMiniCarrito(${item.id_productos}, 1)">+</button>
                            <button style="background: none; border: none; color: #dc2626; cursor: pointer; margin-left: 6px; font-size:1.1rem;" onclick="event.stopPropagation(); removerProductoDesdeMiniCarrito(${item.id_productos})"><i class="bi bi-trash3"></i></button>
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; flex-shrink: 0;"><span style="font-weight: bold; color: #1a2430; font-size: 0.9rem;">$${sub.toFixed(2)}</span></div>
            </div>`;
    });

    const totalHtml = document.getElementById('mini-total-precio');
    if (totalHtml) {
        const ahorro = sumaMenudeoTotal - sumaEstimada;
        if (aplicaMayoreo && ahorro > 0) {
            totalHtml.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap: 5px; margin-top: -5px;">
                    <span style="text-decoration:line-through; color:#94a3b8; font-size:0.95rem; font-weight:normal;">$${sumaMenudeoTotal.toFixed(2)}</span>
                    <span style="color:#10b981; font-size:1.35rem; line-height:1;">$${sumaEstimada.toFixed(2)}</span>
                    <span style="color:#ef4444; font-size:0.9rem; margin-bottom: 10px;">¡Ahorraste $${ahorro.toFixed(2)}!</span>
                </div>
            `;
        } else {
            totalHtml.innerText = `$${sumaEstimada.toFixed(2)}`;
        }
    }
}

async function modificarCantidadDesdeMiniCarrito(id, cambio) {
    let existente = carritoItems.find(c => c.id_productos === id);
    if (!existente) return;

    const nuevaCant = existente.cantidad + cambio;
    if (nuevaCant <= 0) { removerProductoDesdeMiniCarrito(id); return; }
    if (cambio > 0 && nuevaCant > existente.stock_limite) { await mostrarAlerta("Atención", `Inventario máximo alcanzado.`); return; }

    existente.cantidad = nuevaCant;
    localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
    actualizarInterfazCarritoCompleta();
    if (document.getElementById('vista-carrito-principal')) { renderizarListaCarrito(); }
}

function removerProductoDesdeMiniCarrito(id) {
    carritoItems = carritoItems.filter(c => c.id_productos !== id);
    localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
    actualizarInterfazCarritoCompleta();
    if (document.getElementById('vista-carrito-principal')) { renderizarListaCarrito(); }
}

function renderizarListaCarrito() {
    const contenedor = document.getElementById('contenedor-items-carrito');
    if (!contenedor) return;
    if (carritoItems.length === 0) {
        contenedor.innerHTML = `<div class="tarjeta-interna-blanca msj-carrito-vacio">Tu carrito está vacío. ¡Regresa al inicio para agregar productos!</div>`;
        actualizarPreciosBloqueResumen(0, 0, false);
        actualizarBadgeHeader();
        return;
    }

    const piezasTotales = carritoItems.reduce((acumulador, producto) => acumulador + producto.cantidad, 0);
    const aplicaMayoreo = piezasTotales >= minimoMayoreoGlobal;

    let sumaTotalCalculada = 0;
    let sumaMenudeoCalculada = 0;
    let listaHTML = '';

    carritoItems.forEach((producto, index) => {
        const precioUnitario = aplicaMayoreo ? parseFloat(producto.precio_mayoreo) : parseFloat(producto.precio_menudeo);
        const subtotalItem = precioUnitario * producto.cantidad;

        sumaTotalCalculada += subtotalItem;
        sumaMenudeoCalculada += parseFloat(producto.precio_menudeo) * producto.cantidad;

        listaHTML += generarFilaCarritoHTML(producto, index, subtotalItem, aplicaMayoreo);
    });

    contenedor.innerHTML = listaHTML;

    actualizarPreciosBloqueResumen(sumaTotalCalculada, sumaMenudeoCalculada, aplicaMayoreo);
    actualizarBadgeHeader();
}

function generarFilaCarritoHTML(producto, index, subtotal, aplicaMayoreo) {
    const urlImagen = obtenerImagenPrincipal(producto.imagen);
    const etiquetaTipo = aplicaMayoreo ? 'Mayoreo' : 'Menudeo';
    return `
        <div class="tarjeta-interna-blanca fila-articulo-carrito">
            <div class="caja-img-articulo"><img src="${urlImagen}" alt="${producto.nombre}"></div>
            <div class="caja-detalles-articulo">
                <div class="nombre-articulo">${producto.nombre}</div><div class="desc-articulo">Descripción del producto / Detalles adicionales</div>
                <div class="controles-cantidad">Cantidad <input type="number" class="entrada-cantidad" value="${producto.cantidad}" min="1" max="${producto.stock_limite || 99}" onchange="cambiarCantidadInput(${index}, this.value)"></div>
            </div>
            <div class="caja-acciones-articulo">
                <div><div class="etiqueta-precio-amarilla">${formatoMoneda(subtotal)}</div><div class="etiqueta-tipo-precio">${etiquetaTipo}</div></div>
                <button class="boton-basura" onclick="eliminarItemDelCarrito(${index})" title="Eliminar"><i class="bi bi-trash3"></i></button>
            </div>
        </div>`;
}

async function cambiarCantidadInput(index, nuevaCantidadStr) {
    let nuevaCantidad = parseInt(nuevaCantidadStr);
    const item = carritoItems[index];
    if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) { eliminarItemDelCarrito(index); return; }
    if (item.stock_limite && nuevaCantidad > item.stock_limite) {
        await mostrarAlerta("Atención", `Lo sentimos, el inventario está limitado a ${item.stock_limite} piezas.`);
        nuevaCantidad = item.stock_limite;
    }
    item.cantidad = nuevaCantidad;
    localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
    renderizarListaCarrito();
    actualizarInterfazCarritoCompleta();
}

function eliminarItemDelCarrito(index) {
    carritoItems.splice(index, 1);
    localStorage.setItem('carrito_hu_ocho', JSON.stringify(carritoItems));
    renderizarListaCarrito();
    actualizarInterfazCarritoCompleta();
}

function actualizarPreciosBloqueResumen(totalFinal, totalMenudeo = 0, aplicaMayoreo = false) {
    const cajaTexto = document.querySelector('.caja-texto-resumen');
    if (!cajaTexto) return;

    const ahorro = totalMenudeo - totalFinal;

    if (aplicaMayoreo && ahorro > 0) {
        cajaTexto.innerHTML = `
            <div class="titulo-resumen-negrita">Productos a pagar:</div>
            <div style="color: #64748b; font-size: 1.05rem; text-decoration: line-through;">Total sin descuento: <span class="fuente-normal">$${totalMenudeo.toFixed(2)}</span></div>
            <div style="color: #10b981; font-weight: bold; font-size: 1.1rem;">Descuento (Mayoreo): <span class="fuente-normal">-$${ahorro.toFixed(2)}</span></div>
            <div>Envio: <span class="fuente-normal" id="lbl-envio">$0.00</span></div>
            <div style="font-size: 1.4rem; margin-top: 10px; color: #1a2430; font-weight: bold;">
                Total a pagar: <span class="fuente-normal" id="lbl-total" style="color: #ef4444; font-weight: bold;">$${totalFinal.toFixed(2)}</span>
            </div>
        `;
    } else {
        cajaTexto.innerHTML = `
            <div class="titulo-resumen-negrita">Productos a pagar:</div>
            <div>Envio: <span class="fuente-normal" id="lbl-envio">$0.00</span></div>
            <div style="font-size: 1.4rem; margin-top: 10px; font-weight: bold;">
                Total a pagar: <span class="fuente-normal" id="lbl-total" style="color: #ef4444; font-weight: bold;">$${totalFinal.toFixed(2)}</span>
            </div>
        `;
    }
}

async function procesarPagoOrden() {
    if (carritoItems.length === 0) { await mostrarAlerta("Atención", "No tienes productos en tu carrito."); return; }
    document.getElementById('vista-carrito-principal').style.display = 'none';
    document.getElementById('vista-checkout-pago').style.display = 'block';

    if (usuarioSesion) {
        document.getElementById('chk-nombre').value = usuarioSesion.nombre || '';
        document.getElementById('chk-correo').value = usuarioSesion.correo || '';
    } else {
        document.getElementById('chk-nombre').value = '';
        document.getElementById('chk-correo').value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverAlCarrito() {
    document.getElementById('vista-checkout-pago').style.display = 'none';
    document.getElementById('vista-carrito-principal').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function enviarPedidoWhatsApp() {
    if (carritoItems.length === 0) { await mostrarAlerta("Atención", "Tu carrito está vacío."); return; }

    const nombre = document.getElementById('chk-nombre').value.trim();
    const telefono = document.getElementById('chk-telefono').value.trim();

    const calle = document.getElementById('chk-calle').value.trim();
    const numExt = document.getElementById('chk-num-ext').value.trim();
    const numInt = document.getElementById('chk-num-int').value.trim();
    const colonia = document.getElementById('chk-colonia').value.trim();
    const ciudad = document.getElementById('chk-ciudad').value.trim();
    const cp = document.getElementById('chk-cp').value.trim();
    const referencias = document.getElementById('chk-referencias').value.trim();

    const requiereEnvio = document.getElementById('chk-envio-domicilio').checked;

    if (!nombre || !telefono) {
        await mostrarAlerta("Faltan datos", "Por favor, ingresa al menos tu nombre y teléfono.");
        return;
    }

    const telefonoNumeros = telefono.replace(/\D/g, '');
    if (telefonoNumeros.length !== 10) {
        await mostrarAlerta("Teléfono Inválido", "El número de teléfono debe tener exactamente 10 dígitos.");
        return;
    }

    if (requiereEnvio && (!calle || !numExt || !colonia || !ciudad || !cp)) {
        await mostrarAlerta("Dirección Incompleta", "Si requieres envío a domicilio, por favor completa todos los campos obligatorios de tu dirección (calle, número exterior, colonia, municipio y CP).");
        return;
    }

    if (requiereEnvio && cp.length !== 5) {
        await mostrarAlerta("Código Postal Inválido", "El Código Postal debe tener exactamente 5 números.");
        return;
    }

    const idsCarrito = carritoItems.map(item => item.id_productos);

    const { data: productosReales, error } = await supabaseClient
        .from('productos')
        .select('id_productos, nombre, precio_menudeo, precio_mayoreo')
        .in('id_productos', idsCarrito);

    if (error || !productosReales) {
        await mostrarAlerta("Error", "No se pudieron verificar los precios con el servidor.");
        return;
    }

    let detallesProductos = "";
    let totalPedido = 0;

    const piezasTotales = carritoItems.reduce((acc, p) => acc + p.cantidad, 0);
    const aplicaMayoreo = piezasTotales >= minimoMayoreoGlobal;

    carritoItems.forEach(itemCliente => {
        const productoReal = productosReales.find(p => p.id_productos === itemCliente.id_productos);

        if (productoReal) {
            const precioSeguro = aplicaMayoreo ? parseFloat(productoReal.precio_mayoreo) : parseFloat(productoReal.precio_menudeo);
            const subtotal = precioSeguro * itemCliente.cantidad;

            totalPedido += subtotal;

            detallesProductos += `- ${itemCliente.cantidad}x ${productoReal.nombre} ($${subtotal.toFixed(2)})\n`;
        }
    });

    let numeroWa = "528118168554";
    try {
        const { data } = await supabaseClient.from('configuracion').select('whatsapp_admin').eq('id_config', 1).single();
        if (data && data.whatsapp_admin) numeroWa = data.whatsapp_admin;
    } catch (error) { console.error("No se pudo cargar la configuración de WhatsApp", error); }

    const textoEnvio = requiereEnvio ? "Envío a domicilio (Nuevo León)" : "Pasaré a recoger a la tienda";

    let direccionFormateada = "N/A";
    if (requiereEnvio) {
        direccionFormateada = `${calle} #${numExt}`;
        if (numInt) direccionFormateada += ` (Int. ${numInt})`;
        direccionFormateada += `, Col. ${colonia}, ${ciudad}, N.L., CP: ${cp}`;
        if (referencias) direccionFormateada += `\nReferencias: ${referencias}`;
    }

    let mensajeFinal = `Hola, soy ${nombre}. Quiero hacer un pedido:\n\n${detallesProductos}\nEntrega: ${textoEnvio}\nDirección:\n${direccionFormateada}\n\nTeléfono de contacto: ${telefono}\n\nTotal a pagar: $${totalPedido.toFixed(2)}`;

    const urlWhatsApp = `https://wa.me/${numeroWa.replace(/\D/g, '')}?text=${encodeURIComponent(mensajeFinal)}`;

    carritoItems = [];
    localStorage.removeItem('carrito_hu_ocho');
    window.open(urlWhatsApp, '_blank');
    setTimeout(() => {
        window.location.href = "index.html";
    }, 500);
}

document.addEventListener("DOMContentLoaded", () => {

    const inputNombre = document.getElementById('chk-nombre');
    if (inputNombre) {
        inputNombre.addEventListener('input', function () {
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        });
    }

    const inputTelefono = document.getElementById('chk-telefono');
    if (inputTelefono) {
        inputTelefono.addEventListener('input', function () {
            let numeros = this.value.replace(/\D/g, '').substring(0, 10);
            let formateado = '';
            if (numeros.length > 0) formateado += numeros.substring(0, 2);
            if (numeros.length > 2) formateado += ' ' + numeros.substring(2, 6);
            if (numeros.length > 6) formateado += ' ' + numeros.substring(6, 10);
            this.value = formateado;
        });
    }

    ['chk-num-ext', 'chk-num-int'].forEach(id => {
        const inputNum = document.getElementById(id);
        if (inputNum) {
            inputNum.addEventListener('input', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 4);
            });
        }
    });

    const inputCp = document.getElementById('chk-cp');
    if (inputCp) {
        inputCp.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 5);
        });
    }

    ['chk-calle', 'chk-colonia', 'chk-referencias'].forEach(id => {
        const inputTexto = document.getElementById(id);
        if (inputTexto) {
            inputTexto.addEventListener('input', function () {
                this.value = this.value.replace(/[<>={}]/g, '');
            });
        }
    });
});