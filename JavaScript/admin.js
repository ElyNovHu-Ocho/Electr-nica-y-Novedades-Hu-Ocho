async function verificarSeguridadAdmin() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error || !session) {
        alert("Acceso denegado. Tu sesión es inválida o ha expirado.");
        sessionStorage.removeItem('usuario_sesion');
        window.location.replace('index.html');
        return;
    }

    const { data: adminAuth } = await supabaseClient
        .from('administrador')
        .select('id_administrador')
        .eq('correo', session.user.email)
        .single();

    if (!adminAuth) {
        window.location.replace('index.html');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    verificarSeguridadAdmin();

    const addFileInput = document.getElementById('add-imagen');
    if (addFileInput) {
        addFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const addImgPreview = document.getElementById('img-preview');
                addImgPreview.src = URL.createObjectURL(file);
                addImgPreview.style.display = 'block';
                document.getElementById('btn-remove-img').style.display = 'inline-block';
            }
        });
    }

    const editFileInput = document.getElementById('edit-imagen');
    if (editFileInput) {
        editFileInput.addEventListener('change', function (e) {
            renderizarGaleriaEdicion();
        });
    }

    const formConfig = document.getElementById('form-config-global');
    if (formConfig) {
        formConfig.addEventListener('submit', async function (e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            btn.innerText = "Actualizando...";
            btn.disabled = true;

            try {
                const payload = {
                    facebook: document.getElementById('cfg-facebook').value,
                    direccion: document.getElementById('cfg-direccion').value,
                    correo_contacto: document.getElementById('cfg-correo').value,
                    horarios: document.getElementById('cfg-horarios').value,
                    telefono_contacto: document.getElementById('cfg-telefono').value,
                    minimo_mayoreo: document.getElementById('cfg-mayoreo').value,
                    aviso_tienda: document.getElementById('cfg-aviso').value,
                    whatsapp_admin: document.getElementById('cfg-whatsapp') ? document.getElementById('cfg-whatsapp').value : '',
                    texto_footer: document.getElementById('cfg-texto-footer') ? document.getElementById('cfg-texto-footer').value : ''
                };
                const { error } = await supabaseClient.from('configuracion').update(payload).eq('id_config', 1);
                if (error) throw error;
                await mostrarAlerta("Éxito", "¡Toda la configuración se actualizó correctamente!");
            } catch (error) {
                await mostrarAlerta("Error", "Error al actualizar la base de datos: " + error.message);
            } finally {
                btn.innerText = "Actualizar Todo";
                btn.disabled = false;
            }
        });
    }

    const formAgregar = document.getElementById('form-agregar-producto');
    if (formAgregar) {
        formAgregar.addEventListener('submit', async function (e) {
            e.preventDefault();
            const btn = document.getElementById('btn-subir');
            btn.innerText = "Procesando...";
            btn.disabled = true;

            try {
                const id_categoria = document.getElementById('add-categoria').value;
                const nombre = document.getElementById('add-nombre').value.trim();
                const marca = document.getElementById('add-marca').value.trim();
                const descripcion = document.getElementById('add-desc').value.trim();
                const precio_menudeo = parseFloat(document.getElementById('add-menudeo').value);
                const precio_mayoreo = parseFloat(document.getElementById('add-mayoreo').value);
                const stock = parseInt(document.getElementById('add-stock').value);

                const archivoInput = document.getElementById('add-imagen');
                const file = archivoInput.files[0];

                if (!file) throw new Error("Por favor, selecciona una imagen.");

                btn.innerText = "Comprimiendo imagen...";
                const compressedFile = await imageCompression(file, {
                    maxSizeMB: 0.35,
                    maxWidthOrHeight: 1200,
                    useWebWorker: false,
                    fileType: 'image/webp'
                });

                btn.innerText = "Subiendo imagen...";
                const fileName = `${Date.now()}_nuevo_prod.webp`;
                const { error: uploadError } = await supabaseClient.storage.from('imagenes').upload(fileName, compressedFile, { contentType: 'image/webp' });
                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseClient.storage.from('imagenes').getPublicUrl(fileName);
                const urlFinal = publicUrlData.publicUrl;

                btn.innerText = "Guardando en base de datos...";
                const payload = {
                    id_categorias: id_categoria,
                    nombre: nombre,
                    marca: marca,
                    descripcion: descripcion,
                    precio_menudeo: precio_menudeo,
                    precio_mayoreo: precio_mayoreo,
                    stock: stock,
                    imagen: urlFinal
                };

                const { error: dbError } = await supabaseClient.from('productos').insert([payload]);
                if (dbError) throw dbError;

                await mostrarAlerta("Éxito", "¡El producto ha sido agregado al catálogo!");
                formAgregar.reset();
                quitarImagenAgregar();

            } catch (error) {
                await mostrarAlerta("Error", "Problema al subir el producto: " + error.message);
            } finally {
                btn.innerText = "Subir Producto";
                btn.disabled = false;
                cargarTablaProductos();
            }
        });
    }
});

window.renderizarGaleriaEdicion = function () {
    const editGalleryPreview = document.getElementById('edit-gallery-preview');
    const hiddenInput = document.getElementById('edit-imagen-actual');
    const editFileInput = document.getElementById('edit-imagen');

    if (editGalleryPreview) editGalleryPreview.innerHTML = '';

    if (hiddenInput && hiddenInput.value && hiddenInput.value !== 'borrado') {
        const urls = hiddenInput.value.split(',').map(u => u.trim()).filter(u => u !== "");
        urls.forEach(url => {
            editGalleryPreview.innerHTML += `
                <div style="position:relative; display:inline-block; margin: 5px;">
                    <img src="${url}" style="width: 85px; height: 85px; object-fit: cover; border-radius: 8px; border: 2px solid #334155;">
                    <button type="button" onclick="eliminarImagenIndividual('${url}')" style="position:absolute; top:-10px; right:-10px; background:#ef4444; color:white; border:2px solid #0f172a; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer; display:flex; justify-content:center; align-items:center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); transition:0.2s;">X</button>
                </div>`;
        });
    }

    const files = editFileInput ? editFileInput.files : [];
    if (files && files.length > 0) {
        Array.from(files).forEach((file, index) => {
            editGalleryPreview.innerHTML += `
                <div style="position:relative; display:inline-block; margin: 5px;">
                    <img src="${URL.createObjectURL(file)}" style="width: 85px; height: 85px; object-fit: cover; border-radius: 8px; border: 2px dashed #0ea5e9;">
                    <div style="position:absolute; bottom:2px; left:0; width:100%; text-align:center; font-size:10px; background:rgba(15, 23, 42, 0.8); color:#0ea5e9; padding:2px 0; font-weight:bold; border-radius:0 0 8px 8px;">NUEVA</div>
                    <button type="button" onclick="eliminarImagenNueva(${index})" style="position:absolute; top:-10px; right:-10px; background:#f59e0b; color:black; border:2px solid #0f172a; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer; display:flex; justify-content:center; align-items:center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); transition:0.2s;">X</button>
                </div>`;
        });
    }
}

window.eliminarImagenIndividual = function (urlToRemove) {
    const hiddenInput = document.getElementById('edit-imagen-actual');
    let currentUrls = hiddenInput.value.split(',').map(u => u.trim()).filter(u => u !== "");

    currentUrls = currentUrls.filter(u => u !== urlToRemove);

    if (currentUrls.length === 0) {
        hiddenInput.value = "borrado";
    } else {
        hiddenInput.value = currentUrls.join(', ');
    }
    renderizarGaleriaEdicion();
};

window.eliminarImagenNueva = function (indexToRemove) {
    const editFileInput = document.getElementById('edit-imagen');
    const dt = new DataTransfer();
    const files = editFileInput.files;

    for (let i = 0; i < files.length; i++) {
        if (i !== indexToRemove) {
            dt.items.add(files[i]);
        }
    }
    editFileInput.files = dt.files;
    renderizarGaleriaEdicion();
};

function toggleMenu() {
    const menu = document.getElementById('sidebar-menu');
    if (menu) menu.classList.toggle('open');
}

function cambiarVista(idVista, elementoMenu) {
    document.querySelectorAll('.elemento-menu').forEach(item => item.classList.remove('active'));
    elementoMenu.classList.add('active');
    document.querySelectorAll('.panel-vista').forEach(panel => panel.classList.remove('activa'));
    document.getElementById(`vista-${idVista}`).classList.add('activa');

    const menu = document.getElementById('sidebar-menu');
    if (menu) menu.classList.remove('open');

    if (idVista === 'inicio') { obtenerVisitas(); obtenerStockBajo(); }
    if (idVista === 'agregar') { cargarCategoriasSelect(); }
    if (idVista === 'modificar') { cargarTablaProductos(); }
    if (idVista === 'categorias') { cargarTablaCategorias(); }
    if (idVista === 'configuracion') { cargarConfiguracionGlobal(); cargarAdministradores(); }
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

async function obtenerVisitas() {
    const { count } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true });
    document.getElementById('count-visitas').innerText = count || 0;
}

async function obtenerStockBajo() {
    const { data } = await supabaseClient.from('productos').select('nombre, stock').lt('stock', 5).order('stock', { ascending: true });
    const tbody = document.getElementById('tabla-criticos');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="color:#4ade80; font-weight:bold;">Inventario Sano</td></tr>';
    } else {
        data.forEach(p => tbody.innerHTML += `<tr><td style="text-align:left;">${p.nombre}</td><td><span style="background:#f87171; color:white; padding:4px 8px; border-radius:4px;">${p.stock} pzas</span></td></tr>`);
    }
}

async function cargarCategoriasSelect() {
    const { data } = await supabaseClient.from('categorias').select('*').order('nombre_categoria', { ascending: true });
    const select = document.getElementById('add-categoria');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecciona una Categoría --</option>';
    if (data) data.forEach(c => select.innerHTML += `<option value="${c.id_categorias}">${c.nombre_categoria}</option>`);
}

function quitarImagenAgregar() {
    const addFileInput = document.getElementById('add-imagen');
    if (addFileInput) addFileInput.value = "";
    const addImgPreview = document.getElementById('img-preview');
    if (addImgPreview) { addImgPreview.src = ""; addImgPreview.style.display = 'none'; }
    document.getElementById('btn-remove-img').style.display = 'none';
}

async function cargarTablaProductos() {
    const { data: categorias } = await supabaseClient.from('categorias').select('*');
    if (categorias) categorias.forEach(cat => mapaCategorias[cat.id_categorias] = cat.nombre_categoria);
    const { data: productos } = await supabaseClient.from('productos').select('*').order('id_productos', { ascending: false });
    renderizarTablaProductos(productos || []);
}

function renderizarTablaProductos(productos) {
    const tbody = document.getElementById('tabla-productos-body');
    if (!tbody) return;
    let filasHTML = '';
    productos.forEach(producto => {
        const stockStyle = producto.stock < 5 ? "background:rgba(248,113,113,0.2); color:#f87171;" : "color:white;";
        const categoriaNombre = mapaCategorias[producto.id_categorias] || 'N/A';
        filasHTML += `<tr>
            <td style="text-align:left;">${producto.nombre}</td><td>${categoriaNombre}</td><td>${producto.marca}</td>
            <td>${formatoMoneda(producto.precio_menudeo)}</td><td>${formatoMoneda(producto.precio_mayoreo)}</td>
            <td><span style="padding:4px 8px; border-radius:4px; font-weight:bold; ${stockStyle}">${producto.stock}</span></td>
            <td>
                <span class="enlace-accion brillo-amarillo" onclick="abrirModalEditar(${producto.id_productos})">Editar</span>
                <span class="enlace-accion brillo-verde" onclick="abrirModalStock(${producto.id_productos}, '${producto.nombre}')">Stock</span>
                <span class="enlace-accion brillo-rojo" onclick="eliminarProducto(${producto.id_productos})">Eliminar</span>
            </td>
        </tr>`;
    });
    tbody.innerHTML = filasHTML;
}

async function abrirModalEditar(id) {
    const { data } = await supabaseClient.from('productos').select('*').eq('id_productos', id).single();
    if (data) {
        document.getElementById('edit-id').value = data.id_productos;
        document.getElementById('edit-nombre').value = data.nombre;
        document.getElementById('edit-marca').value = data.marca;
        document.getElementById('edit-menudeo').value = data.precio_menudeo;
        document.getElementById('edit-mayoreo').value = data.precio_mayoreo;

        const editFileInput = document.getElementById('edit-imagen');
        if (editFileInput) editFileInput.value = "";

        const editImagenActual = document.getElementById('edit-imagen-actual');

        if (data.imagen && data.imagen.trim() !== "") {
            editImagenActual.value = data.imagen;
        } else {
            editImagenActual.value = "borrado";
        }

        renderizarGaleriaEdicion();

        document.getElementById('modal-editar').style.display = 'flex';
    }
}

async function guardarEdicion() {
    const btn = document.getElementById('btn-guardar-edicion');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    try {
        const id = document.getElementById('edit-id').value;
        let payload = {
            nombre: document.getElementById('edit-nombre').value,
            marca: document.getElementById('edit-marca').value,
            precio_menudeo: document.getElementById('edit-menudeo').value,
            precio_mayoreo: document.getElementById('edit-mayoreo').value
        };

        const editFileInput = document.getElementById('edit-imagen');
        const files = editFileInput ? editFileInput.files : [];
        const estadoImagen = document.getElementById('edit-imagen-actual').value;

        const { data: oldProd } = await supabaseClient.from('productos').select('imagen').eq('id_productos', id).single();
        let urlsViejasBD = [];
        if (oldProd && oldProd.imagen && oldProd.imagen.trim() !== "") {
            urlsViejasBD = oldProd.imagen.split(',').map(u => u.trim());
        }

        let urlsFinales = [];
        if (estadoImagen !== 'borrado' && estadoImagen.trim() !== "") {
            urlsFinales = estadoImagen.split(',').map(u => u.trim());
        }

        let urlsABorrarStorage = urlsViejasBD.filter(url => !urlsFinales.includes(url));
        for (let url of urlsABorrarStorage) {
            const partesUrl = url.split('/');
            const nombreArchivo = partesUrl[partesUrl.length - 1];
            if (nombreArchivo) await supabaseClient.storage.from('imagenes').remove([nombreArchivo]);
        }

        if (files.length > 0) {
            btn.innerText = "Subiendo imágenes nuevas...";
            for (let i = 0; i < files.length; i++) {
                const compressedFile = await imageCompression(files[i], { maxSizeMB: 0.35, maxWidthOrHeight: 1200, useWebWorker: false, fileType: 'image/webp' });
                const fileName = `${Date.now()}_${i}_prod_edit.webp`;

                await supabaseClient.storage.from('imagenes').upload(fileName, compressedFile, { contentType: 'image/webp' });
                const { data } = supabaseClient.storage.from('imagenes').getPublicUrl(fileName);

                urlsFinales.push(data.publicUrl);
            }
        }

        if (urlsFinales.length > 0) {
            payload.imagen = urlsFinales.join(', ');
        } else {
            payload.imagen = null;
        }

        btn.innerText = "Actualizando Base de Datos...";
        await supabaseClient.from('productos').update(payload).eq('id_productos', id);
        cerrarModal('modal-editar');
        cargarTablaProductos();
    } catch (err) {
        await mostrarAlerta("Error", "Error al actualizar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Cambios";
    }
}

function abrirModalStock(id, nombre) {
    document.getElementById('stock-id').value = id;
    document.getElementById('titulo-stock').innerText = `Stock: ${nombre}`;
    document.getElementById('input-cantidad').value = "";
    document.getElementById('modal-stock').style.display = 'flex';
}

async function ejecutarStock(accion) {
    const id = document.getElementById('stock-id').value;
    const cant = parseInt(document.getElementById('input-cantidad').value);
    if (isNaN(cant) || cant <= 0) return await mostrarAlerta("Atención", "Cantidad inválida");
    const { data } = await supabaseClient.from('productos').select('stock').eq('id_productos', id).single();
    const nuevo = accion === 'sumar' ? (data.stock + cant) : (data.stock - cant);
    if (nuevo < 0) return await mostrarAlerta("Atención", "El stock no puede ser negativo");
    await supabaseClient.from('productos').update({ stock: nuevo }).eq('id_productos', id);
    cerrarModal('modal-stock');
    cargarTablaProductos();
}

async function eliminarProducto(id) {
    if (await mostrarConfirmacion("Seguridad", "¿Estás seguro de eliminar este producto definitivamente?")) {
        await supabaseClient.from('productos').delete().eq('id_productos', id);
        cargarTablaProductos();
    }
}

async function cargarTablaCategorias() {
    const { data } = await supabaseClient.from('categorias').select('*').order('id_categorias', { ascending: true });
    const tbody = document.getElementById('lista-categorias');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (data) data.forEach(c => {
        tbody.innerHTML += `<tr>
            <td style="text-align:left; padding-left: 20px; font-weight:bold;">${c.nombre_categoria}</td>
            <td><span class="enlace-accion brillo-verde" onclick="editarCategoria(${c.id_categorias}, '${c.nombre_categoria}')">Modificar</span>
            <span class="enlace-accion brillo-rojo" onclick="borrarCategoria(${c.id_categorias}, '${c.nombre_categoria}')">Eliminar</span></td>
        </tr>`;
    });
}

async function nuevaCategoria() {
    const datos = await abrirModalUniversal("Nueva Categoría", "Escribe el nombre de la nueva categoría:", [{ id: "input-cat-nombre", tipo: "text", placeholder: "Ej. Memorias RAM" }]);
    if (datos && datos['input-cat-nombre'] !== "") {
        await supabaseClient.from('categorias').insert([{ nombre_categoria: datos['input-cat-nombre'] }]);
        cargarTablaCategorias();
    }
}

async function editarCategoria(id, nombreActual) {
    const datos = await abrirModalUniversal("Modificar Categoría", `Editando la categoría actual:`, [{ id: "input-cat-edit", tipo: "text", placeholder: "Nuevo nombre" }]);
    const inputEdit = document.getElementById('input-cat-edit');
    if (inputEdit) inputEdit.value = nombreActual;

    if (datos && datos['input-cat-edit'] !== "" && datos['input-cat-edit'] !== nombreActual) {
        await supabaseClient.from('categorias').update({ nombre_categoria: datos['input-cat-edit'] }).eq('id_categorias', id);
        cargarTablaCategorias();
    }
}

async function borrarCategoria(id, nombre) {
    if (await mostrarConfirmacion("Atención", `¿Estás seguro de borrar la categoría "${nombre}"?`)) {
        const { error } = await supabaseClient.from('categorias').delete().eq('id_categorias', id);
        if (error) await mostrarAlerta("Error", "Asegúrate de que no haya productos usando esta categoría primero.");
        else cargarTablaCategorias();
    }
}

async function cargarAdministradores() {
    const { data } = await supabaseClient.from('administrador').select('*');
    const tbody = document.getElementById('tabla-admins-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (data) data.forEach(a => {
        tbody.innerHTML += `<tr><td>${a.nombre}</td><td>${a.correo}</td><td><span class="enlace-accion brillo-rojo" onclick="eliminarAdminPorId(${a.id_administrador})">Opciones</span></td></tr>`;
    });
}

async function agregarNuevoAdmin() {
    const datos = await abrirModalUniversal("Crear Administrador", "Ingresa los datos para el nuevo acceso:", [
        { id: "admin-nom", tipo: "text", placeholder: "Nombre completo" },
        { id: "admin-corr", tipo: "email", placeholder: "Correo electrónico" },
        { id: "admin-pass", tipo: "password", placeholder: "Contraseña (mín. 8 caracteres)" }
    ]);

    if (datos && datos['admin-nom'] && datos['admin-corr'] && datos['admin-pass']) {
        if (datos['admin-pass'].length < 8) return await mostrarAlerta("Atención", "La contraseña debe tener al menos 8 caracteres por seguridad.");

        const { error } = await supabaseClient.auth.signUp({ email: datos['admin-corr'], password: datos['admin-pass'] });
        if (error) return await mostrarAlerta("Error", "Error al crear credenciales de seguridad: " + error.message);

        const { error: dbError } = await supabaseClient.from('administrador').insert([{ nombre: datos['admin-nom'], correo: datos['admin-corr'] }]);
        if (dbError) await mostrarAlerta("Error", "Error al guardar en la tabla: " + dbError.message);
        else {
            await mostrarAlerta("Éxito", "¡Nuevo administrador creado y autorizado con éxito!");
            cargarAdministradores();
        }
    } else if (datos) {
        await mostrarAlerta("Atención", "Por favor, llena todos los campos (Nombre, Correo y Contraseña) para crear al administrador.");
    }
}

async function eliminarAdminPorId(id) {
    if (await mostrarConfirmacion("Seguridad", "¿Estás seguro de remover este administrador?")) {
        const { data: adminData, error: fetchError } = await supabaseClient.from('administrador').select('correo').eq('id_administrador', id).single();
        if (fetchError) return await mostrarAlerta("Error", "Error al buscar el administrador: " + fetchError.message);

        const { error: deleteError } = await supabaseClient.from('administrador').delete().eq('id_administrador', id);
        if (deleteError) await mostrarAlerta("Error", "Error al eliminar: " + deleteError.message);
        else {
            await mostrarAlerta("Aviso", `Removido exitosamente.\nSi deseas revocar su acceso por completo, elimínalo de Supabase Auth (Correo: ${adminData.correo}).`);
            cargarAdministradores();
        }
    }
}

async function cargarConfiguracionGlobal() {
    const { data } = await supabaseClient.from('configuracion').select('*').eq('id_config', 1).single();
    if (data) {
        if (document.getElementById('cfg-facebook')) document.getElementById('cfg-facebook').value = data.facebook || '';
        if (document.getElementById('cfg-horarios')) document.getElementById('cfg-horarios').value = data.horarios || '';
        if (document.getElementById('cfg-direccion')) document.getElementById('cfg-direccion').value = data.direccion || '';
        if (document.getElementById('cfg-telefono')) document.getElementById('cfg-telefono').value = data.telefono_contacto || '';
        if (document.getElementById('cfg-correo')) document.getElementById('cfg-correo').value = data.correo_contacto || '';
        if (document.getElementById('cfg-mayoreo')) document.getElementById('cfg-mayoreo').value = data.minimo_mayoreo || 6;
        if (document.getElementById('cfg-aviso')) document.getElementById('cfg-aviso').value = data.aviso_tienda || '';
        if (document.getElementById('cfg-texto-footer')) document.getElementById('cfg-texto-footer').value = data.texto_footer || '';
        if (document.getElementById('cfg-whatsapp')) document.getElementById('cfg-whatsapp').value = data.whatsapp_admin || '';
    }
}
async function cargarEstadisticasAdmin() {
    const lblVisitas = document.getElementById('count-visitas');
    if (!lblVisitas) return;

    try {
        const { data, error } = await supabaseClient
            .from('visitas')
            .select('cantidad');

        if (error) {
            console.error("Error al consultar visitas:", error);
            lblVisitas.innerText = '0';
            return;
        }

        const totalVisitas = data.reduce((acum, fila) => acum + (fila.cantidad || 0), 0);
        lblVisitas.innerText = totalVisitas;
    } catch (err) {
        console.error("Error cargando contador:", err);
        lblVisitas.innerText = '0';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarEstadisticasAdmin();
});