const SUPABASE_URL = "https://lzqltchzefuttbvhcrlq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cWx0Y2h6ZWZ1dHRidmhjcmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTA3ODMsImV4cCI6MjA5NDc4Njc4M30.z8IFypXSV7j5w396Jk9B7q9z2xTT4RG-TFzFhVpED6c";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaProductosGlobal = [];
let carritoItems = JSON.parse(localStorage.getItem('carrito_hu_ocho')) || [];
let authModoActual = 'login';
let usuarioSesion = JSON.parse(sessionStorage.getItem('usuario_sesion')) || null;
let productoViendoActualmente = null;
let minimoMayoreoGlobal = 6;
let mapaCategorias = {};
let pedidosGlobales = [];
const PEDIDOS_POR_PAGINA = 8;

function cerrarModalUniversal() {
    const modal = document.getElementById('modal-universal');
    if (modal) modal.style.display = 'none';
    const contenedorInputs = document.getElementById('modal-uni-inputs');
    if (contenedorInputs) contenedorInputs.innerHTML = '';
}

function mostrarAlerta(titulo, texto) {
    return abrirModalUniversal(titulo, texto, [], false, true);
}

function mostrarConfirmacion(titulo, texto) {
    return abrirModalUniversal(titulo, texto, [], true, false);
}

function abrirModalUniversal(titulo, texto, camposInputs = [], esConfirm = false, esAlerta = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-universal');
        if (!modal) {
            if (esAlerta) { alert(texto); resolve(true); return; }
            if (esConfirm) { resolve(confirm(texto)); return; }
            let res = prompt(texto);
            let ret = {};
            if (camposInputs.length > 0 && res) ret[camposInputs[0].id] = res;
            resolve(ret ? ret : false);
            return;
        }

        document.getElementById('modal-uni-titulo').innerText = titulo;
        document.getElementById('modal-uni-texto').innerText = texto;

        const contenedorInputs = document.getElementById('modal-uni-inputs');
        contenedorInputs.innerHTML = '';

        if (camposInputs && camposInputs.length > 0) {
            camposInputs.forEach(campo => {
                const inputHtml = `<input type="${campo.tipo}" id="${campo.id}" placeholder="${campo.placeholder}" class="control-formulario" style="background-color: #0f172a; color: white; border: 1px solid #475569; text-align: center;">`;
                contenedorInputs.innerHTML += inputHtml;
            });
        }

        modal.style.display = 'flex';

        const btnAceptar = document.getElementById('btn-modal-uni-aceptar');
        const btnCancelar = document.getElementById('btn-modal-uni-cancelar');

        btnAceptar.replaceWith(btnAceptar.cloneNode(true));
        btnCancelar.replaceWith(btnCancelar.cloneNode(true));

        const nuevoBtnAceptar = document.getElementById('btn-modal-uni-aceptar');
        const nuevoBtnCancelar = document.getElementById('btn-modal-uni-cancelar');

        if (esAlerta) {
            nuevoBtnCancelar.style.display = 'none';
            nuevoBtnAceptar.innerText = 'Entendido';
            nuevoBtnAceptar.style.width = '100%';
        } else {
            nuevoBtnCancelar.style.display = 'block';
            nuevoBtnAceptar.innerText = 'Aceptar';
            nuevoBtnAceptar.style.width = 'auto';
        }

        nuevoBtnAceptar.onclick = () => {
            if (esAlerta || esConfirm) {
                cerrarModalUniversal();
                resolve(true);
            } else {
                const resultados = {};
                camposInputs.forEach(campo => {
                    const el = document.getElementById(campo.id);
                    if (el) resultados[campo.id] = el.value.trim();
                });

                cerrarModalUniversal();
                resolve(resultados);
            }
        };

        nuevoBtnCancelar.onclick = () => {
            cerrarModalUniversal();
            resolve(false);
        };
    });
}

window.onload = () => {
    if (document.getElementById('vista-inicio')) {
        obtenerVisitas();
        obtenerStockBajo();
    } else if (document.getElementById('vista-carrito-principal')) {
        inicializarPantallaCarrito();
    } else {
        arrancarAplicacionCliente();
    }
};

window.addEventListener('click', function (e) {
    const cartWrapper = document.querySelector('.cart-btn-box');
    if (cartWrapper && !cartWrapper.parentElement.contains(e.target)) {
        const previewFlotante = document.getElementById('preview-flotante-carrito');
        if (previewFlotante) previewFlotante.style.display = 'none';
    }
});

function formatoMoneda(cantidad) {
    return `$${parseFloat(cantidad || 0).toFixed(2)}`;
}

function obtenerImagenPrincipal(stringImagenes, placeholder = 'https://via.placeholder.com/150') {
    if (!stringImagenes || stringImagenes.trim() === "") return placeholder;
    return stringImagenes.split(',')[0].trim();
}