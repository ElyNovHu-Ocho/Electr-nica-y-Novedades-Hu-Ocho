function verificarSiEsAdminOculto() {
    const menuDropdown = document.getElementById('dropdown-menu-usuario');
    if (!usuarioSesion) {
        if (menuDropdown) menuDropdown.innerHTML = '';
        return;
    }
    if (usuarioSesion.rol === 'admin') {
        if (menuDropdown) menuDropdown.innerHTML = `<div style="background: #1a2430; color: #facc15; padding: 8px 15px; font-size: 0.75rem; font-weight: bold; text-align: center;">MODO ADMINISTRADOR</div><a href="panel_admin.html">Panel de Control</a><button style="color: #ef4444; border-top: 1px solid #e2e8f0; width:100%; text-align:left; background:none; border:none; padding:10px; cursor:pointer;" onclick="cerrarSesionUsuario()">Cerrar Sesión Admin</button>`;
    }
}

async function ingresarComoAdminFooter(e) {
    if (e) e.preventDefault();
    if (!usuarioSesion) {
        abrirModalAuth();
    } else if (usuarioSesion.rol === 'admin') {
        window.location.href = 'panel_admin.html';
    } else {
        await mostrarAlerta("Acceso Denegado", "Tu cuenta no tiene permisos de administrador.");
    }
}

function cerrarSesionUsuario() {
    sessionStorage.removeItem('usuario_sesion');
    usuarioSesion = null;
    window.location.replace('index.html');
}

function abrirModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) {
        modal.style.display = 'flex';
        const formContent = document.getElementById('form-auth-content');
        if (formContent) {
            formContent.innerHTML = `
                <label>Correo Electrónico Administrador</label>
                <input type="email" id="auth-email" class="entrada-auth" placeholder="ejemplo@correo.com">
                <label>Contraseña</label>
                <input type="password" id="auth-pass" class="entrada-auth" placeholder="Tu contraseña">
                <button class="boton-enviar-auth" onclick="ejecutarAutenticacion()">Ingresar al Panel</button>`;
        }
    }
}

function cerrarModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.style.display = 'none';
}

async function ejecutarAutenticacion() {
    const email = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-pass').value;

    if (!email || !password) {
        await mostrarAlerta("Atención", "Ingresa correo y contraseña");
        return;
    }

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (authError) {
        await mostrarAlerta("Error", "Credenciales incorrectas. Verifica tu acceso de administrador.");
        return;
    }

    let { data: usuario } = await supabaseClient.from('administrador').select('*').eq('correo', email).maybeSingle();

    if (usuario) {
        usuario.rol = 'admin';
        sessionStorage.setItem('usuario_sesion', JSON.stringify(usuario));
        usuarioSesion = usuario;
        window.location.href = 'panel_admin.html';
    } else {
        await mostrarAlerta("Acceso Denegado", "No tienes permisos de administrador en la base de datos.");
        cerrarSesionUsuario();
    }
}