import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, setDoc, getDoc, getDocs, limit, collectionGroup } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// ==========================================
// MOTOR MULTI-TENANT (RUTEADOR DE INQUILINOS)
// ==========================================
const getTenantId = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname.includes('vercel.app')) {
    return 'demo';
  }
  return hostname.split('.')[0];
};

const tenantId = getTenantId();

// ==========================================
// HELPER: CONTRASTE DINÁMICO (ACCESIBILIDAD)
// ==========================================
const obtenerColorTextoContraste = (hexColor) => {
  const colorBase = hexColor || '#2c3e50'; 
  const hex = colorBase.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) || 0;
  const g = parseInt(hex.substr(2, 2), 16) || 0;
  const b = parseInt(hex.substr(4, 2), 16) || 0;
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#111827' : '#ffffff'; 
};

// ==========================================
// APP PRINCIPAL (CON GUARDIA DE TRÁFICO)
// ==========================================
export default function App() {
 // INTERCEPTOR DE RUTA PARA EL SÚPER ADMIN (A prueba de Vercel)
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get('master') === 'true') {
    return <SuperAdminDashboard />;
  }

  const [vistaActual, setVistaActual] = useState('cliente'); 
  const [productos, setProductos] = useState([]);
  const [config, setConfig] = useState({
    nombre: 'Cargando restaurante...',
    logoUrl: '',
    colorPrincipal: '#2c3e50',
    colorSecundario: '#e67e22',
    direccion: '',
    banco: '',
    cuenta: '',
    titular: '',
    ruc: '',
    telefono: '',
    // VARIABLES SAAS GLOBALES
    moneda: 'Gs.',
    estadoSuscripcion: 'demo',
    fechaFinDemo: new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0]
  });

  const [mesaAsignada, setMesaAsignada] = useState('');
  const [nombreComensal, setNombreComensal] = useState('');
  const [inputNombreTemp, setInputNombreTemp] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesaParam = params.get('mesa');
    if (mesaParam) setMesaAsignada(mesaParam);
  }, []);

  useEffect(() => {
    const unsubscribeProd = onSnapshot(collection(db, `restaurantes/${tenantId}/productos`), (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => docs.push({ ...doc.data(), id: doc.id }));
      setProductos(docs);
    });
    return () => unsubscribeProd();
  }, []);

  useEffect(() => {
    const unsubscribeConfig = onSnapshot(doc(db, `restaurantes/${tenantId}/configuracion`, "datos"), (docSnap) => {
      if (docSnap.exists()) setConfig(prev => ({ ...prev, ...docSnap.data() }));
    });
    return () => unsubscribeConfig();
  }, []);

  // LÓGICA DE CONTROL DE PERÍODO DE PRUEBA (PAYWALL GATEKEEPER)
  const hoyStr = new Date().toISOString().split('T')[0];
  const demoExpirada = config.estadoSuscripcion === 'demo' && hoyStr > (config.fechaFinDemo || '2026-01-01');
  const cuentaSuspendida = config.estadoSuscripcion === 'suspendido';
  const requierePago = demoExpirada || cuentaSuspendida;

  // REGLA UX: SI LA DEMO EXPIRO, PINTAMOS EL CORDÓN DE SEGURIDAD PARA COMENSALES
  if (requierePago && vistaActual === 'cliente') {
    return (
      <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', background: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.04)', maxWidth: '450px', border: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: '50px' }}>⚙️</span>
          <h2 style={{ color: '#111827', fontWeight: '900', marginTop: '15px' }}>Menú en Mantenimiento</h2>
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6', fontWeight: '500', marginBottom: '30px' }}>Estamos optimizando nuestra plataforma digital para brindarte un mejor servicio. Por favor, solicita la carta física o asistencia al personal del local.</p>
          
          {/* BOTÓN DE RESCATE (PUERTA TRASERA PARA STAFF / ALDO) */}
          <button onClick={() => setVistaActual('admin')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontWeight: '700', fontSize: '14px', cursor: 'pointer', borderTop: '1px solid #f3f4f6', paddingTop: '20px', width: '100%' }}>
            Ingreso Staff / Operador SaaS
          </button>
        </div>
      </div>
    );
  }

  // RENDER PANTALLA BIENVENIDA (SOFT UI)
  if (vistaActual === 'cliente' && !nombreComensal) {
    return (
      <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: 'radial-gradient(circle at top center, #ffffff 0%, #f3f4f6 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px 30px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.03)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          
          {config?.logoUrl ? (
            <div style={{ background: '#f8f9fa', width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 25px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
              <img src={config.logoUrl} alt="Logo" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
            </div>
          ) : (
            <div style={{ background: 'rgba(79, 70, 229, 0.1)', width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto 25px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>🍽️</div>
          )}

          <h2 style={{ color: '#111827', marginTop: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '-1px' }}>{config?.nombre}</h2>
          
          {mesaAsignada ? (
            <div style={{ background: 'rgba(79, 70, 229, 0.05)', color: '#4f46e5', padding: '10px 20px', borderRadius: '20px', display: 'inline-block', fontWeight: '800', marginBottom: '30px', fontSize: '14px' }}>
              📍 Mesa {mesaAsignada}
            </div>
          ) : (
            <div style={{ marginBottom: '25px' }}>
              <input type="number" value={mesaAsignada} onChange={e => setMesaAsignada(e.target.value)} placeholder="Número de Mesa" style={{ width: '100%', padding: '18px', boxSizing: 'border-box', borderRadius: '16px', border: '2px solid transparent', background: '#f3f4f6', textAlign: 'center', fontSize: '16px', fontWeight: '600', color: '#111827', outline: 'none', transition: '0.3s' }} onFocus={(e) => {e.target.style.borderColor = config?.colorPrincipal || '#2c3e50'; e.target.style.background = 'white';}} onBlur={(e) => {e.target.style.borderColor = 'transparent'; e.target.style.background = '#f3f4f6';}} />
            </div>
          )}
          
          <p style={{ marginBottom: '15px', fontWeight: '600', color: '#6b7280', fontSize: '15px' }}>¿A nombre de quién hacemos el pedido?</p>
          <input type="text" value={inputNombreTemp} onChange={e => setInputNombreTemp(e.target.value)} placeholder="Tu nombre o apodo" style={{ width: '100%', padding: '18px', marginBottom: '25px', boxSizing: 'border-box', borderRadius: '16px', border: '2px solid transparent', background: '#f3f4f6', fontSize: '16px', fontWeight: '600', textAlign: 'center', color: '#111827', outline: 'none', transition: '0.3s' }} onFocus={(e) => {e.target.style.borderColor = config?.colorPrincipal || '#2c3e50'; e.target.style.background = 'white';}} onBlur={(e) => {e.target.style.borderColor = 'transparent'; e.target.style.background = '#f3f4f6';}} />
          
          <button onClick={() => { if (inputNombreTemp.trim() && mesaAsignada) setNombreComensal(inputNombreTemp.trim()); else alert("Completá tu nombre y mesa."); }} style={{ width: '100%', padding: '18px', background: config?.colorPrincipal || '#2c3e50', color: obtenerColorTextoContraste(config?.colorPrincipal), border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '16px', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', transition: '0.3s' }} onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>
            Ver el Menú
          </button>
          
          <button onClick={() => setVistaActual('admin')} style={{ background: 'none', border: 'none', color: '#9ca3af', marginTop: '25px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Ingreso Staff / Cocina</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: config?.colorPrincipal || '#2c3e50', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: obtenerColorTextoContraste(config?.colorPrincipal), boxShadow: '0 4px 20px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: '10px', position: 'sticky', top: 0, zIndex: 100 }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '800' }}>
          {config?.logoUrl ? <img src={config.logoUrl} alt="Logo" style={{ height: '40px', width: '40px', borderRadius: '10px', objectFit: 'contain', background: 'white', padding: '4px' }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} /> : <span style={{ fontSize: '24px'}}>🍽️</span>}
          {config?.nombre} {mesaAsignada && <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px', fontSize: '14px' }}>Mesa {mesaAsignada}</span>}
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setVistaActual('cliente')} style={{ padding: '8px 16px', cursor: 'pointer', background: vistaActual === 'cliente' ? (config?.colorSecundario || '#3498db') : 'rgba(255,255,255,0.1)', color: vistaActual === 'cliente' ? obtenerColorTextoContraste(config?.colorSecundario) : obtenerColorTextoContraste(config?.colorPrincipal), border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px', transition: '0.3s' }}>Vista Menú</button>
          <button onClick={() => setVistaActual('admin')} style={{ padding: '8px 16px', cursor: 'pointer', background: vistaActual === 'admin' ? (config?.colorSecundario || '#e67e22') : 'rgba(255,255,255,0.1)', color: vistaActual === 'admin' ? obtenerColorTextoContraste(config?.colorSecundario) : obtenerColorTextoContraste(config?.colorPrincipal), border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px', transition: '0.3s' }}>Panel Staff</button>
        </div>
      </nav>

      <div style={{ flex: '1' }}>
        {vistaActual === 'cliente' ? (
          <VistaCliente menu={productos} restauranteConfig={config} mesaFija={mesaAsignada} comensal={nombreComensal} />
        ) : (
          <VistaAdmin inventario={productos} restauranteConfig={config} paywallBloqueado={requierePago} />
        )}
      </div>

      <footer style={{ background: 'white', color: '#6b7280', padding: '25px', marginTop: 'auto', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '13px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <strong style={{ color: '#111827' }}>{config?.nombre}</strong> — {config?.direccion || 'No configurada'}
          <br />
          <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', display: 'inline-block' }}>Powered by Master Resto B2B Platform © 2026</span>
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// MÓDULO: VISTA CLIENTE (DINE-IN UI)
// ==========================================
function VistaCliente({ menu, restauranteConfig, mesaFija, comensal }) {
  const [tabMovil, setTabMovil] = useState('pedir'); 
  const [filtroCategoriaCli, setFiltroCategoriaCli] = useState('Todas');
  
  const [carrito, setCarrito] = useState([]);
  const [productoConfigurando, setProductoConfigurando] = useState(null);
  const [cantidadTemp, setCantidadTemp] = useState(1);
  const [toppingsElegidos, setToppingsElegidos] = useState([]);

  const [pedidosDeLaMesa, setPedidosDeLaMesa] = useState([]);
  const [iniciandoPago, setIniciandoPago] = useState(false);
  const [alertaPagoActiva, setAlertaPagoActiva] = useState(null);

  const [propinaPct, setPropinaPct] = useState(10);
  const [formaDePago, setFormaDePago] = useState('efectivo');
  const [tipoDivision, setTipoDivision] = useState('separadas'); 
  const [necesitaFactura, setNecesitaFactura] = useState(false);
  const [facturaRuc, setFacturaRuc] = useState('');
  const [facturaNombre, setFacturaNombre] = useState('');

  // MULTIMONEDA APLICADA AL CLIENTE
  const divisa = restauranteConfig?.moneda || 'Gs.';

  const menuActivo = menu.filter(p => p.estado === 'activo');
  const categoriasUnicas = ['Todas', ...new Set(menuActivo.map(p => p.categoria || 'General'))];
  const menuFiltrado = filtroCategoriaCli === 'Todas' ? menuActivo : menuActivo.filter(p => (p.categoria || 'General') === filtroCategoriaCli);

  useEffect(() => {
    if (!mesaFija) return;
    const q = query(collection(db, `restaurantes/${tenantId}/pedidos`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const consumos = [];
      let alerta = null;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.mesa === mesaFija) {
          if (data.tipo === 'comanda' && data.estado !== 'pagado') {
            consumos.push({ ...data, id: doc.id });
          }
          if (data.tipo === 'alerta_caja' && data.estado === 'pendiente_cobro') {
            if (data.tipo_division === 'paga_uno' || data.solicitante === comensal) {
              alerta = { ...data, id: doc.id };
            }
          }
        }
      });
      setPedidosDeLaMesa(consumos);
      setAlertaPagoActiva(alerta);
    });
    return () => unsubscribe();
  }, [mesaFija, comensal]);

  const iniciarConfiguracion = (prod) => {
    setProductoConfigurando(prod);
    setCantidadTemp(1);
    setToppingsElegidos([]); 
  };

  const modificarCantidadTopping = (topping, delta) => {
    setToppingsElegidos(prev => {
      const index = prev.findIndex(t => t.nombre === topping.nombre);
      if (index >= 0) {
        const nuevaCantidad = prev[index].cantidad + delta;
        if (nuevaCantidad <= 0) return prev.filter((_, i) => i !== index);
        const nuevoArray = [...prev];
        nuevoArray[index] = { ...nuevoArray[index], cantidad: nuevaCantidad };
        return nuevoArray;
      } else if (delta > 0) return [...prev, { ...topping, cantidad: 1 }];
      return prev;
    });
  };

  const confirmarProductoAlCarrito = () => {
    const costoToppings = toppingsElegidos.reduce((acc, t) => acc + ((t.precio || 0) * t.cantidad), 0);
    const precioBaseCalculo = productoConfigurando.precio_promo > 0 ? productoConfigurando.precio_promo : (productoConfigurando.precio_base || 0);
    const precioUnitarioTotal = precioBaseCalculo + costoToppings;
    
    setCarrito([...carrito, {
      id_item: Math.random().toString(36).substr(2, 9), 
      estado_item: 'nuevo', 
      id_prod: productoConfigurando.id,
      nombre: productoConfigurando.nombre,
      toppings: toppingsElegidos,
      textToppings: toppingsElegidos.map(t => `${t.cantidad}x ${t.nombre}`).join(', '),
      cantidad: cantidadTemp,
      precio_unitario: precioUnitarioTotal,
      subtotal_item: precioUnitarioTotal * cantidadTemp
    }]);
    setProductoConfigurando(null);
  };

  const eliminarDelCarrito = (indexToRemove) => {
    setCarrito(carrito.filter((_, index) => index !== indexToRemove));
  };

  const enviarComandaCocina = async () => {
    if (carrito.length === 0) return alert("Tu bandeja está vacía.");
    const totalComanda = carrito.reduce((acc, item) => acc + (item.subtotal_item || 0), 0);

    const nuevaComanda = {
      tipo: 'comanda', 
      mesa: mesaFija,
      comensal: comensal, 
      items: carrito,
      total: totalComanda,
      estado: 'nuevo',
      fecha: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, `restaurantes/${tenantId}/pedidos`), nuevaComanda);
      alert("¡Pedido en preparación!");
      setCarrito([]);
      setTabMovil('cuenta'); 
      setIniciandoPago(false); 
    } catch (error) {
      console.error(error);
    }
  };

  const resumenPorComensal = pedidosDeLaMesa.reduce((acc, ped) => {
    const persona = ped.comensal || 'Sin identificar';
    if (!acc[persona]) acc[persona] = { total: 0, items: [] };
    acc[persona].total += (ped.total || 0);
    if(ped.items && Array.isArray(ped.items)) {
      acc[persona].items.push(...ped.items);
    }
    return acc;
  }, {});

  const subtotalMesa = pedidosDeLaMesa.reduce((acc, ped) => acc + (ped.total || 0), 0);
  const subtotalPersonal = pedidosDeLaMesa.filter(p => p.comensal === comensal).reduce((acc, ped) => acc + (ped.total || 0), 0);
  
  const subtotalCobro = tipoDivision === 'separadas' ? subtotalPersonal : subtotalMesa;
  const montoPropinaCobro = (subtotalCobro * propinaPct) / 100;
  const totalGeneralCobro = subtotalCobro + montoPropinaCobro;

  const solicitarCuentaCaja = async () => {
    if (subtotalCobro === 0) return alert("No hay consumos para cobrar en esta modalidad.");
    if (necesitaFactura && (!facturaRuc.trim() || !facturaNombre.trim())) {
      return alert("Si requieres factura, completa el RUC y Razón Social.");
    }

    if (alertaPagoActiva) {
      alert("Hemos notificado nuevamente al mozo sobre tu mesa. Enseguida te atienden.");
      return;
    }

    if (window.confirm(`¿Llamar al mozo para pagar?`)) {
      try {
        await addDoc(collection(db, `restaurantes/${tenantId}/pedidos`), {
          tipo: 'alerta_caja',
          mesa: mesaFija,
          solicitante: comensal,
          metodo_solicitado: formaDePago,
          tipo_division: tipoDivision, 
          facturacion: necesitaFactura ? { ruc: facturaRuc, nombre: facturaNombre } : 'Consumidor Final',
          propina_pct: propinaPct,
          propina_monto: montoPropinaCobro,
          subtotal: subtotalCobro,
          total_final: totalGeneralCobro,
          estado: 'pendiente_cobro',
          fecha: new Date().toISOString()
        });
        alert("Caja notificada. El mozo está en camino.");
        setIniciandoPago(false);
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div style={{ padding: '15px', maxWidth: '800px', margin: '0 auto', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      
      {/* TABS SUPERIORES */}
      <div style={{ display: 'flex', marginBottom: '25px', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)' }}>
        <button onClick={() => {setTabMovil('pedir'); setIniciandoPago(false);}} style={{ flex: 1, padding: '16px', border: 'none', background: tabMovil === 'pedir' ? (restauranteConfig?.colorPrincipal || '#2c3e50') : 'transparent', color: tabMovil === 'pedir' ? obtenerColorTextoContraste(restauranteConfig?.colorPrincipal) : '#6b7280', fontWeight: '800', fontSize: '15px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
          🍝 Menú & Pedidos
        </button>
        <button onClick={() => setTabMovil('cuenta')} style={{ flex: 1, padding: '16px', border: 'none', background: tabMovil === 'cuenta' ? '#10b981' : 'transparent', color: tabMovil === 'cuenta' ? 'white' : '#6b7280', fontWeight: '800', fontSize: '15px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
          🧾 Mi Cuenta
        </button>
      </div>

      {tabMovil === 'pedir' ? (
        <div>
          {productoConfigurando ? (
            <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.03)' }}>
              {productoConfigurando.imagenUrl && (
                <img src={productoConfigurando.imagenUrl} alt={productoConfigurando.nombre} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '16px', marginBottom: '20px' }} />
              )}
              
              <span style={{ display: 'inline-block', background: 'rgba(79, 70, 229, 0.1)', color: restauranteConfig?.colorPrincipal || '#4f46e5', padding: '6px 12px', borderRadius: '30px', fontSize: '12px', fontWeight: '800', marginBottom: '12px' }}>{productoConfigurando.categoria || 'General'}</span>
              <h3 style={{ marginTop: 0, color: '#111827', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' }}>{productoConfigurando.nombre}</h3>
              
              {productoConfigurando.precio_promo > 0 ? (
                <p style={{ fontSize: '22px', fontWeight: '900', color: '#ef4444' }}>
                  <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '15px', marginRight: '10px' }}>{divisa} {(productoConfigurando.precio_base || 0).toLocaleString()}</span>
                  {divisa} {productoConfigurando.precio_promo.toLocaleString()}
                </p>
              ) : (
                <p style={{ fontSize: '22px', fontWeight: '900', color: restauranteConfig?.colorPrincipal || '#10b981' }}>{divisa} {(productoConfigurando.precio_base || 0).toLocaleString()}</p>
              )}
              
              {productoConfigurando.toppings && productoConfigurando.toppings.length > 0 && (
                <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '16px', margin: '25px 0', border: '1px solid #f3f4f6' }}>
                  <strong style={{ display: 'block', marginBottom: '15px', color: '#374151', fontSize: '15px' }}>Agrega tus Extras:</strong>
                  {productoConfigurando.toppings.map((t, idx) => {
                    const toppingEnEstado = toppingsElegidos.find(item => item.nombre === t.nombre);
                    const cant = toppingEnEstado ? toppingEnEstado.cantidad : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#4b5563' }}>{t.nombre} (+{divisa} {(t.precio || 0).toLocaleString()})</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <button onClick={() => modificarCantidadTopping(t, -1)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: cant > 0 ? '#ef4444' : '#e5e7eb', color: cant > 0 ? 'white' : '#9ca3af', border: 'none', cursor: cant > 0 ? 'pointer' : 'default', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                          <span style={{ fontWeight: '800', width: '15px', textAlign: 'center', fontSize: '15px' }}>{cant}</span>
                          <button onClick={() => modificarCantidadTopping(t, 1)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: restauranteConfig?.colorPrincipal || '#3b82f6', color: obtenerColorTextoContraste(restauranteConfig?.colorPrincipal), border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginBottom: '30px', textAlign: 'center', background: '#f9fafb', padding: '20px', borderRadius: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '15px', color: '#374151', fontSize: '14px' }}>Cantidad de platos iguales:</strong>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center' }}>
                  <button onClick={() => setCantidadTemp(Math.max(1, cantidadTemp - 1))} style={{ width: '45px', height: '45px', borderRadius: '12px', fontSize: '20px', fontWeight: 'bold', background: 'white', color: '#4b5563', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}>-</button>
                  <span style={{ fontSize: '24px', fontWeight: '900', width: '30px', textAlign: 'center', color: '#111827' }}>{cantidadTemp}</span>
                  <button onClick={() => setCantidadTemp(cantidadTemp + 1)} style={{ width: '45px', height: '45px', borderRadius: '12px', fontSize: '20px', fontWeight: 'bold', background: 'white', color: '#4b5563', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <button onClick={confirmarProductoAlCarrito} style={{ padding: '18px', background: restauranteConfig?.colorPrincipal || '#2c3e50', color: obtenerColorTextoContraste(restauranteConfig?.colorPrincipal), border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>Añadir a mi Bandeja</button>
                <button onClick={() => setProductoConfigurando(null)} style={{ padding: '16px', background: 'transparent', color: '#6b7280', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>Cancelar / Volver</button>
              </div>
            </div>
          ) : (
            <div>
              {carrito.length > 0 && (
                <div style={{ background: '#fdf4ff', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: '1px solid #fae8ff', boxShadow: '0 10px 25px rgba(232, 121, 249, 0.1)' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#a21caf', fontSize: '16px', fontWeight: '800' }}>Bandeja de {comensal} (Pendiente)</h4>
                  {carrito.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '10px', borderBottom: '1px solid #fae8ff', paddingBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#4a044e' }}>{item.cantidad}x {item.nombre}</strong> <span style={{ color: '#86198f', fontWeight: '600' }}>({divisa} {(item.subtotal_item || 0).toLocaleString()})</span>
                        {item.toppings && item.toppings.length > 0 && <span style={{ display: 'block', fontSize: '12px', color: '#d946ef', marginTop: '4px' }}>Con: {item.textToppings}</span>}
                      </div>
                      <button onClick={() => eliminarDelCarrito(i)} style={{ background: '#fce7f3', color: '#be185d', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
                    </div>
                  ))}
                  <button onClick={enviarComandaCocina} style={{ width: '100%', padding: '18px', background: restauranteConfig?.colorSecundario || '#d946ef', color: obtenerColorTextoContraste(restauranteConfig?.colorSecundario || '#d946ef'), border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '15px', marginTop: '10px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
                    🔔 ORDENAR ESTO A COCINA
                  </button>
                </div>
              )}
              
              {/* BARRA DE CATEGORÍAS */}
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '10px', scrollbarWidth: 'none' }}>
                {categoriasUnicas.map(cat => (
                  <button key={cat} onClick={() => setFiltroCategoriaCli(cat)} style={{ padding: '12px 24px', background: filtroCategoriaCli === cat ? (restauranteConfig?.colorPrincipal || '#2c3e50') : '#f3f4f6', color: filtroCategoriaCli === cat ? obtenerColorTextoContraste(restauranteConfig?.colorPrincipal) : '#4b5563', border: 'none', borderRadius: '30px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.3s ease', boxShadow: filtroCategoriaCli === cat ? '0 8px 20px rgba(0,0,0,0.1)' : 'none' }}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* LISTA DE PRODUCTOS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', paddingBottom: '80px' }}>
                {menuFiltrado.map(prod => (
                  <div key={prod.id} style={{ background: 'white', padding: '16px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    {prod.imagenUrl ? (
                      <img src={prod.imagenUrl} alt={prod.nombre} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '16px', marginBottom: '15px', background: '#f3f4f6' }} />
                    ) : (
                      <div style={{ width: '100%', height: '160px', backgroundColor: '#f9fafb', borderRadius: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: '40px', fontWeight: '900' }}>
                        {prod.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '18px', fontWeight: '800', lineHeight: '1.2' }}>{prod.nombre}</h3>
                      </div>
                      {prod.precio_promo > 0 ? (
                        <p style={{ fontSize: '18px', fontWeight: '900', color: '#ef4444', margin: '0 0 15px 0' }}>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '13px', marginRight: '8px' }}>{divisa} {(prod.precio_base || 0).toLocaleString()}</span>
                          {divisa} {prod.precio_promo.toLocaleString()}
                        </p>
                      ) : (
                        <p style={{ fontSize: '18px', fontWeight: '900', color: restauranteConfig?.colorPrincipal || '#10b981', margin: '0 0 15px 0' }}>{divisa} {(prod.precio_base || 0).toLocaleString()}</p>
                      )}
                    </div>
                    <button onClick={() => iniciarConfiguracion(prod)} style={{ width: '100%', padding: '14px', background: restauranteConfig?.colorPrincipal || '#34495e', color: obtenerColorTextoContraste(restauranteConfig?.colorPrincipal), border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: '800', fontSize: '15px', transition: '0.3s' }}>Agregar al pedido</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.03)' }}>
          <h2 style={{ marginTop: 0, textAlign: 'center', color: '#111827', fontWeight: '900' }}>Cuenta de la Mesa {mesaFija}</h2>
          
          {pedidosDeLaMesa.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '15px' }}>🍽️</span>
              <p style={{ color: '#6b7280', fontWeight: '500' }}>Aún no han ordenado nada.</p>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '25px' }}>
                {Object.keys(resumenPorComensal).map((persona) => (
                  <div key={persona} style={{ background: '#f9fafb', padding: '20px', borderRadius: '16px', marginBottom: '15px', border: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '12px' }}>
                      <strong style={{ fontSize: '16px', color: '#4f46e5', fontWeight: '800' }}>Consumo de {persona}</strong>
                      <strong style={{ fontSize: '16px', color: '#111827', fontWeight: '900' }}>{divisa} {(resumenPorComensal[persona].total || 0).toLocaleString()}</strong>
                    </div>
                    {resumenPorComensal[persona].items.map((item, i) => (
                      <div key={i} style={{ fontSize: '14px', marginBottom: '6px', color: '#4b5563', fontWeight: '500' }}>
                        {item.cantidad}x {item.nombre} 
                        {item.toppings && item.toppings.length > 0 && <span style={{ color: '#9ca3af', fontSize: '12px' }}> (+ {item.textToppings})</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {alertaPagoActiva ? (
                <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '2px dashed #e5e7eb', paddingTop: '25px' }}>
                  <div style={{ background: '#ecfdf5', color: '#065f46', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontWeight: '800', fontSize: '14px', border: '1px solid #a7f3d0' }}>
                    ✓ Cuenta solicitada en modalidad: {alertaPagoActiva.tipo_division === 'separadas' ? 'CUENTAS SEPARADAS' : 'PAGO ÚNICO'} ({alertaPagoActiva.metodo_solicitado.toUpperCase()})
                  </div>
                  <button onClick={solicitarCuentaCaja} style={{ width: '100%', padding: '20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 25px rgba(245, 158, 11, 0.2)' }}>
                    ⚠️ RE-LLAMAR AL MOZO (DEMORA)
                  </button>
                </div>
              ) : !iniciandoPago ? (
                <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '2px dashed #e5e7eb', paddingTop: '25px' }}>
                  <span style={{ display: 'block', color: '#6b7280', fontSize: '14px', fontWeight: '600' }}>Subtotal Consumido ({tipoDivision === 'separadas' ? 'Tu parte' : 'Toda la mesa'})</span>
                  <h3 style={{ color: '#111827', fontSize: '32px', marginTop: '5px', fontWeight: '900', letterSpacing: '-1px' }}>{divisa} {(subtotalCobro || 0).toLocaleString()}</h3>
                  <button onClick={() => setIniciandoPago(true)} style={{ width: '100%', padding: '20px', background: restauranteConfig?.colorPrincipal || '#10b981', color: obtenerColorTextoContraste(restauranteConfig?.colorPrincipal), border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                    PEDIR LA CUENTA / PAGAR
                  </button>
                </div>
              ) : (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  <div style={{ marginBottom: '20px', background: '#fef3c7', padding: '20px', borderRadius: '16px', border: '1px solid #fde68a' }}>
                    <strong style={{ display: 'block', marginBottom: '15px', color: '#92400e', fontSize: '16px' }}>¿Cómo van a pagar?</strong>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: '#78350f' }}>
                      <input type="radio" name="pago" value="separadas" checked={tipoDivision === 'separadas'} onChange={() => setTipoDivision('separadas')} style={{ transform: 'scale(1.3)', marginRight: '12px' }} />
                      Pagaré solo lo mío (Separadas)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: '#78350f' }}>
                      <input type="radio" name="pago" value="paga_uno" checked={tipoDivision === 'paga_uno'} onChange={() => setTipoDivision('paga_uno')} style={{ transform: 'scale(1.3)', marginRight: '12px' }} />
                      Pagaré todo junto (Mesa entera)
                    </label>
                  </div>

                  <div style={{ border: '2px solid #f3f4f6', padding: '20px', borderRadius: '16px', marginBottom: '25px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '16px', color: '#4b5563', fontWeight: '600' }}>
                      <span>Subtotal Consumido:</span>
                      <strong style={{ color: '#111827' }}>{divisa} {(subtotalCobro || 0).toLocaleString()}</strong>
                    </div>

                    <div style={{ marginBottom: '20px', borderBottom: '1px solid #f3f4f6', paddingBottom: '20px' }}>
                      <strong style={{ display: 'block', marginBottom: '12px', fontSize: '15px', color: '#111827' }}>¿Deseas agregar Propina al Staff?</strong>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setPropinaPct(0)} style={{ flex: 1, padding: '12px', background: propinaPct === 0 ? (restauranteConfig?.colorPrincipal || '#4f46e5') : '#f3f4f6', color: propinaPct === 0 ? obtenerColorTextoContraste(restauranteConfig?.colorPrincipal) : '#4b5563', border: 'none', borderRadius: '12px', fontWeight: '800' }}>0%</button>
                        <button onClick={() => setPropinaPct(10)} style={{ flex: 1, padding: '12px', background: propinaPct === 10 ? (restauranteConfig?.colorPrincipal || '#4f46e5') : '#f3f4f6', color: propinaPct === 10 ? obtenerColorTextoContraste(restauranteConfig?.colorPrincipal) : '#4b5563', border: 'none', borderRadius: '12px', fontWeight: '800' }}>10%</button>
                        <button onClick={() => setPropinaPct(15)} style={{ flex: 1, padding: '12px', background: propinaPct === 15 ? (restauranteConfig?.colorPrincipal || '#4f46e5') : '#f3f4f6', color: propinaPct === 15 ? obtenerColorTextoContraste(restauranteConfig?.colorPrincipal) : '#4b5563', border: 'none', borderRadius: '12px', fontWeight: '800' }}>15%</button>
                      </div>
                    </div>

                    {propinaPct > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '16px', color: '#10b981', fontWeight: '800' }}>
                        <span>Propina Sugerida ({propinaPct}%):</span>
                        <span>+ {divisa} {(montoPropinaCobro || 0).toLocaleString()}</span>
                      </div>
                    )}

                    <div style={{ background: restauranteConfig?.colorPrincipal || '#111827', color: obtenerColorTextoContraste(restauranteConfig?.colorPrincipal), padding: '25px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                      <span style={{ display: 'block', fontSize: '14px', marginBottom: '8px', opacity: 0.8, fontWeight: '600' }}>Monto Total a Pagar</span>
                      <strong style={{ display: 'block', fontSize: '32px', fontWeight: '900', letterSpacing: '-1px' }}>{divisa} {(totalGeneralCobro || 0).toLocaleString()}</strong>
                    </div>
                  </div>

                  <div style={{ marginBottom: '25px' }}>
                    <strong style={{ display: 'block', marginBottom: '12px', color: '#111827', fontSize: '15px' }}>Medio de pago requerido:</strong>
                    <select value={formaDePago} onChange={(e) => setFormaDePago(e.target.value)} style={{ width: '100%', padding: '18px', fontSize: '16px', borderRadius: '12px', border: '2px solid transparent', background: '#f3f4f6', fontWeight: '600', color: '#111827', outline: 'none' }}>
                      <option value="efectivo">Cobro en Efectivo</option>
                      <option value="pos">Lector POS (Tarjetas)</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                    </select>

                    {formaDePago === 'transferencia' && (
                      <div style={{ background: '#ecfdf5', color: '#065f46', padding: '20px', borderRadius: '16px', marginTop: '15px', border: '1px solid #a7f3d0', fontSize: '14px' }}>
                        <strong style={{ display: 'block', marginBottom: '10px', fontSize: '15px' }}>🏦 Datos de Transferencia:</strong>
                        Banco: <strong>{restauranteConfig?.banco || 'N/A'}</strong><br/>
                        Cuenta: <strong>{restauranteConfig?.cuenta || 'N/A'}</strong><br/>
                        Titular: <strong>{restauranteConfig?.titular || 'N/A'}</strong><br/>
                        RUC: <strong>{restauranteConfig?.ruc || 'N/A'}</strong>
                        <span style={{ display: 'block', marginTop: '15px', fontSize: '12px', opacity: 0.8, fontWeight: '600' }}>* Presiona Confirmar y muestra el comprobante al mozo.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '30px', background: '#f9fafb', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                    <strong style={{ display: 'block', marginBottom: '15px', color: '#111827', fontSize: '15px' }}>🧾 Info Facturación</strong>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', cursor: 'pointer', fontWeight: '600', color: '#4b5563' }}>
                      <input type="checkbox" checked={!necesitaFactura} onChange={(e) => setNecesitaFactura(!e.target.checked)} style={{ transform: 'scale(1.3)', marginRight: '12px' }} />
                      Consumidor Final (Sin nombre)
                    </label>
                    
                    {necesitaFactura && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                        <input type="text" placeholder="RUC / CI" value={facturaRuc} onChange={e => setFacturaRuc(e.target.value)} style={{ padding: '16px', borderRadius: '12px', border: '2px solid transparent', background: 'white', fontWeight: '600', outline: 'none' }} />
                        <input type="text" placeholder="Razón Social / Nombre Completo" value={facturaNombre} onChange={e => setFacturaNombre(e.target.value)} style={{ padding: '16px', borderRadius: '12px', border: '2px solid transparent', background: 'white', fontWeight: '600', outline: 'none' }} />
                      </div>
                    )}
                  </div>

                  <button onClick={solicitarCuentaCaja} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)' }}>
                    🔔 CONFIRMAR Y PEDIR CUENTA
                  </button>
                  
                  <button onClick={() => setIniciandoPago(false)} style={{ width: '100%', padding: '18px', background: 'transparent', color: '#6b7280', border: 'none', marginTop: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '15px' }}>
                    Cancelar / Volver
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// VISTA ADMIN (SEGURIDAD, REPORTES Y ABM)
// ==========================================
function VistaAdmin({ inventario, restauranteConfig, paywallBloqueado }) {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [permisos, setPermisos] = useState(null); 
  const [usuariosStaff, setUsuariosStaff] = useState([]);
  const [logsABM, setLogsABM] = useState([]);

  // SISTEMA DE TICKETS VIRTUALES
  const [nuevoEmailStaff, setNuevoEmailStaff] = useState('');
  const [permisoCocinaTemp, setPermisoCocinaTemp] = useState(false);
  const [permisoCajaTemp, setPermisoCajaTemp] = useState(false);
  const [permisoAbmTemp, setPermisoAbmTemp] = useState(false);
  const [permisoReportesTemp, setPermisoReportesTemp] = useState(false);
  const [permisoSistemaTemp, setPermisoSistemaTemp] = useState(false);

  const [subModulo, setSubModulo] = useState('cocina'); 
  const [comandasCocina, setComandasCocina] = useState([]);
  const [alertasCaja, setAlertasCaja] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('activos'); 

  const [idEditando, setIdEditando] = useState(null);
  const [nombre, setNombre] = useState('');
  const [precioBase, setPrecioBase] = useState('');
  const [precioPromo, setPrecioPromo] = useState(''); 
  const [imagenUrl, setImagenUrl] = useState(''); 
  const [categoriaSelect, setCategoriaSelect] = useState('Plato Principal'); 
  const [toppingNombre, setToppingNombre] = useState('');
  const [toppingPrecio, setToppingPrecio] = useState('');
  const [toppingsLista, setToppingsLista] = useState([]); 
  const [jsonMasivo, setJsonMasivo] = useState('');

  const [fechaInicioRep, setFechaInicioRep] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFinRep, setFechaFinRep] = useState(new Date().toISOString().split('T')[0]);

  const [inputNombreRest, setInputNombreRest] = useState(restauranteConfig?.nombre || '');
  const [inputLogoUrl, setInputLogoUrl] = useState(restauranteConfig?.logoUrl || ''); 
  const [inputColorPrincipal, setInputColorPrincipal] = useState(restauranteConfig?.colorPrincipal || '#2c3e50'); 
  const [inputColorSecundario, setInputColorSecundario] = useState(restauranteConfig?.colorSecundario || '#e67e22'); 
  const [inputDireccion, setInputDireccion] = useState(restauranteConfig?.direccion || '');
  const [inputBanco, setInputBanco] = useState(restauranteConfig?.banco || '');
  const [inputCuenta, setInputCuenta] = useState(restauranteConfig?.cuenta || '');
  const [inputTitular, setInputTitular] = useState(restauranteConfig?.titular || '');
  const [inputRuc, setInputRuc] = useState(restauranteConfig?.ruc || '');
  const [inputTelefono, setInputTelefono] = useState(restauranteConfig?.telefono || '');
  
  // VARIABLES SAAS CLIENTE
  const [inputMoneda, setInputMoneda] = useState(restauranteConfig?.moneda || 'Gs.');
  const divisa = restauranteConfig?.moneda || 'Gs.';

  // CONTROL DE SESIÓN Y OBTENCIÓN DE PERMISOS
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, `restaurantes/${tenantId}/usuarios`, currentUser.email); 
        const userSnap = await getDoc(userDocRef);
        
        if (!userSnap.exists()) {
          const allUsers = await getDocs(collection(db, `restaurantes/${tenantId}/usuarios`));
          const esPrimerUsuario = allUsers.empty;
          
          const nuevosPermisos = {
            email: currentUser.email,
            admin: esPrimerUsuario,
            cocina: esPrimerUsuario,
            caja: esPrimerUsuario,
            abm: esPrimerUsuario,
            reportes: esPrimerUsuario,
            sistema: esPrimerUsuario
          };
          await setDoc(userDocRef, nuevosPermisos);
          setPermisos(nuevosPermisos);
        } else {
          setPermisos(userSnap.data());
        }
      } else {
        setPermisos(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !permisos) return;
    
    const unsubLogs = onSnapshot(query(collection(db, `restaurantes/${tenantId}/logs_abm`), orderBy("fecha", "desc"), limit(30)), (snap) => {
      const logs = [];
      snap.forEach(d => logs.push({ ...d.data(), id: d.id }));
      setLogsABM(logs);
    });

    let unsubUsers = () => {};
    if (permisos?.admin) {
      unsubUsers = onSnapshot(collection(db, `restaurantes/${tenantId}/usuarios`), (snap) => {
        const u = [];
        snap.forEach(d => u.push({ ...d.data(), id: d.id })); 
        setUsuariosStaff(u);
      });
    }

    return () => { unsubLogs(); unsubUsers(); };
  }, [user, permisos]);

  useEffect(() => {
    if (restauranteConfig) {
      setInputNombreRest(restauranteConfig.nombre || '');
      setInputLogoUrl(restauranteConfig.logoUrl || '');
      setInputColorPrincipal(restauranteConfig.colorPrincipal || '#2c3e50');
      setInputColorSecundario(restauranteConfig.colorSecundario || '#e67e22');
      setInputDireccion(restauranteConfig.direccion || '');
      setInputBanco(restauranteConfig.banco || '');
      setInputCuenta(restauranteConfig.cuenta || '');
      setInputTitular(restauranteConfig.titular || '');
      setInputRuc(restauranteConfig.ruc || '');
      setInputTelefono(restauranteConfig.telefono || '');
      setInputMoneda(restauranteConfig.moneda || 'Gs.');
    }
  }, [restauranteConfig]);

  const reproducirAlertaCocina = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'square'; 
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      oscillator.connect(audioCtx.destination);
      oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  };

  const reproducirAlertaCaja = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine'; 
      osc1.frequency.setValueAtTime(1046.50, audioCtx.currentTime); 
      osc1.connect(audioCtx.destination);
      osc1.start(); osc1.stop(audioCtx.currentTime + 0.5);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(830.61, audioCtx.currentTime); 
        osc2.connect(audioCtx.destination);
        osc2.start(); osc2.stop(audioCtx.currentTime + 0.8);
      }, 400);
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `restaurantes/${tenantId}/pedidos`), orderBy("fecha", "desc"));
    const unsubscribePedidos = onSnapshot(q, (snapshot) => {
      const cocinas = [];
      const alertas = [];
      let sonoCocina = false;
      let sonoCaja = false;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (data.tipo === 'comanda' && data.estado === 'nuevo') sonoCocina = true;
          if (data.tipo === 'alerta_caja' && data.estado === 'pendiente_cobro') sonoCaja = true;
        }
      });

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tipo === 'comanda') cocinas.push({ ...data, id: doc.id });
        if (data.tipo === 'alerta_caja') alertas.push({ ...data, id: doc.id });
      });

      setComandasCocina(cocinas);
      setAlertasCaja(alertas);

      if (sonoCaja) reproducirAlertaCaja();
      else if (sonoCocina) reproducirAlertaCocina();
    });
    return () => unsubscribePedidos();
  }, [user]);

  const ejecutarLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert("Credenciales incorrectas o el usuario no fue creado en Firebase Auth."); }
  };

  const notificarTicketAAdminCentral = async (tipoAccion, emailEmpleado, sucursal, detalleRoles) => {
    const payload = {
      service_id: 'service_hcycz9c',
      template_id: 'template_pk1fvye', 
      user_id: 'W5CBOJduRukYQZ8K3', 
      template_params: {
        to_email: 'aldojeda92@gmail.com',
        numero_pedido: `SOPORTE: SOLICITUD DE ${tipoAccion}`,
        cliente: `Sucursal Emisora: ${sucursal}`,
        telefono: `Cuenta afectada: ${emailEmpleado}`,
        total: `Detalle Operativo: ${detalleRoles}`,
        modalidad: "CONTROL ACCESOS SAAS"
      }
    };
    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Error enviando alerta central de control", err);
    }
  };

  const enviarTicketAltaStaff = async (e) => {
    e.preventDefault();
    const emailClean = nuevoEmailStaff.trim().toLowerCase();
    if (!emailClean) return;

    const docRef = doc(db, `restaurantes/${tenantId}/usuarios`, emailClean);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      alert("Este usuario ya se encuentra registrado o tiene una solicitud pendiente.");
      return;
    }

    const permisosSolicitados = {
      cocina: permisoCocinaTemp,
      caja: permisoCajaTemp,
      abm: permisoAbmTemp,
      reportes: permisoReportesTemp,
      sistema: permisoSistemaTemp
    };

    const strRoles = Object.keys(permisosSolicitados).filter(k => permisosSolicitados[k]).join(", ");
    const nombreLocal = restauranteConfig?.nombre || "Sucursal Desconocida";

    await addDoc(collection(db, `restaurantes/${tenantId}/tickets_usuarios`), {
      tipo: "ALTA",
      email: emailClean,
      empresa: nombreLocal,
      permisos_solicitados: permisosSolicitados,
      estado: "pendiente",
      fecha: new Date().toISOString()
    });

    await setDoc(docRef, {
      email: emailClean,
      admin: false,
      ...permisosSolicitados,
      estado_aprobacion: "pendiente_alta"
    });

    await notificarTicketAAdminCentral("ALTA ACCESO", emailClean, nombreLocal, `Permisos Requeridos: ${strRoles || 'Ninguno'}`);

    setNuevoEmailStaff('');
    setPermisoCocinaTemp(false); setPermisoCajaTemp(false); setPermisoAbmTemp(false);
    setPermisoReportesTemp(false); setPermisoSistemaTemp(false);

    alert("Ticket de alta enviado. Se notificó al administrador.");
  };

  const enviarTicketBajaStaff = async (u) => {
    if (window.confirm(`¿Solicitar remoción definitiva de ${u.email}?`)) {
      const nombreLocal = restauranteConfig?.nombre || "Sucursal Desconocida";

      await addDoc(collection(db, `restaurantes/${tenantId}/tickets_usuarios`), {
        tipo: "BAJA",
        email: u.email,
        empresa: nombreLocal,
        estado: "pendiente",
        fecha: new Date().toISOString()
      });

      await updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), {
        estado_aprobacion: "pendiente_baja"
      });

      await notificarTicketAAdminCentral("ELIMINACIÓN BAJA", u.email, nombreLocal, "Eliminar credenciales Auth de inmediato.");

      alert(`Ticket de remoción enviado para ${u.email}. En revisión.`);
    }
  };

  const registrarLogABM = async (accion, detalle) => {
    if (!user) return;
    await addDoc(collection(db, `restaurantes/${tenantId}/logs_abm`), { accion, detalle, usuario: user?.email || 'Anonimo', fecha: new Date().toISOString() });
  };

  const avanzarEstadoItem = async (pedidoId, id_item, nuevoEstado) => {
    const pedido = comandasCocina.find(p => p.id === pedidoId);
    if (!pedido) return;
    const nuevosItems = pedido.items.map((item, index) => {
      const currentKey = item.id_item || index;
      return currentKey === id_item ? { ...item, estado_item: nuevoEstado } : item;
    });
    const todosEntregados = nuevosItems.every(i => i.estado_item === 'entregado' || i.estado_item === 'pagado');
    const estadoDocFinal = todosEntregados ? 'entregado' : pedido.estado;
    await updateDoc(doc(db, `restaurantes/${tenantId}/pedidos`, pedidoId), { items: nuevosItems, estado: estadoDocFinal });
  };

  const avanzarBloqueMesa = async (mesaId, estadoActual, estadoNuevo) => {
    const pedidosMesa = comandasCocina.filter(p => p.mesa === mesaId && p.estado !== 'pagado');
    for (const ped of pedidosMesa) {
        let modificado = false;
        const nuevosItems = ped.items.map(item => {
            const est = item.estado_item || ped.estado; 
            if (est === estadoActual) { modificado = true; return { ...item, estado_item: estadoNuevo }; }
            return item;
        });
        if (modificado) {
            const todosEntregados = nuevosItems.every(i => i.estado_item === 'entregado' || i.estado_item === 'pagado');
            await updateDoc(doc(db, `restaurantes/${tenantId}/pedidos`, ped.id), { items: nuevosItems, estado: todosEntregados ? 'entregado' : ped.estado });
        }
    }
  };

  const facturarMesaCaja = async (mesaId, alerta) => {
    if (alerta && alerta.tipo_division === 'separadas') {
      if (window.confirm(`¿Confirmar cobro individual de ${divisa} ${alerta.total_final.toLocaleString()} a ${alerta.solicitante}? (El resto de la mesa seguirá activa)`)) {
        const comandasPersona = comandasCocina.filter(c => c.mesa === mesaId && c.estado !== 'pagado' && c.comensal === alerta.solicitante);
        for (const comanda of comandasPersona) await updateDoc(doc(db, `restaurantes/${tenantId}/pedidos`, comanda.id), { estado: 'pagado' });
        await updateDoc(doc(db, `restaurantes/${tenantId}/pedidos`, alerta.id), { estado: 'pagado' });
        alert(`Cuenta de ${alerta.solicitante} pagada y liberada.`);
      }
    } else {
      if (window.confirm(`¿Confirmar cobro TOTAL de la Mesa ${mesaId}?`)) {
        const comandasAsociadas = comandasCocina.filter(c => c.mesa === mesaId && c.estado !== 'pagado');
        for (const comanda of comandasAsociadas) await updateDoc(doc(db, `restaurantes/${tenantId}/pedidos`, comanda.id), { estado: 'pagado' });
        const alertasAsociadas = alertasCaja.filter(a => a.mesa === mesaId && a.estado === 'pendiente_cobro');
        for (const al of alertasAsociadas) await updateDoc(doc(db, `restaurantes/${tenantId}/pedidos`, al.id), { estado: 'pagado' });
        alert(`Mesa ${mesaId} facturada y liberada completamente.`);
      }
    }
  };

  const agregarToppingAlListadoTemporal = (e) => {
    e.preventDefault(); 
    if (!toppingNombre.trim() || !toppingPrecio.trim()) return;
    setToppingsLista([...toppingsLista, { nombre: toppingNombre.trim(), precio: parseInt(toppingPrecio) }]);
    setToppingNombre(''); setToppingPrecio('');
  };
  const eliminarToppingTemporal = (idx) => setToppingsLista(toppingsLista.filter((_, i) => i !== idx));

  const iniciarEdicion = (prod) => {
    setIdEditando(prod.id); setNombre(prod.nombre); setPrecioBase(prod.precio_base); setPrecioPromo(prod.precio_promo || '');
    setCategoriaSelect(prod.categoria || 'Plato Principal'); setImagenUrl(prod.imagenUrl || ''); setToppingsLista(prod.toppings || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelarEdicion = () => {
    setIdEditando(null); setNombre(''); setPrecioBase(''); setPrecioPromo(''); setImagenUrl(''); setToppingsLista([]);
  };

  const guardarMenuEnFirebase = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !precioBase) return alert("Nombre y Precio Base son obligatorios.");
    const payload = { 
      nombre: nombre.trim(), precio_base: parseInt(precioBase), precio_promo: precioPromo ? parseInt(precioPromo) : null,
      categoria: categoriaSelect, imagenUrl: imagenUrl.trim(), toppings: toppingsLista 
    };

    if (idEditando) {
      await updateDoc(doc(db, `restaurantes/${tenantId}/productos`, idEditando), payload);
      registrarLogABM("MODIFICACIÓN", `Plato: ${payload.nombre}`);
      alert("Plato Actualizado exitosamente.");
    } else {
      await addDoc(collection(db, `restaurantes/${tenantId}/productos`), { ...payload, estado: "activo" });
      registrarLogABM("ALTA", `Nuevo Plato: ${payload.nombre}`);
      alert("Nuevo plato guardado.");
    }
    cancelarEdicion();
  };

  const procesarInyeccionMasiva = async () => {
    if (!jsonMasivo.trim()) return alert("Pegá un array JSON válido.");
    try {
      const arrayProductos = JSON.parse(jsonMasivo);
      if (!Array.isArray(arrayProductos)) throw new Error("No es un array");
      
      for (let item of arrayProductos) {
        await addDoc(collection(db, `restaurantes/${tenantId}/productos`), {
          nombre: item.nombre || 'Sin Nombre', precio_base: parseInt(item.precio_base) || 0,
          precio_promo: item.precio_promo ? parseInt(item.precio_promo) : null,
          categoria: item.categoria || 'General', imagenUrl: item.imagenUrl || '', estado: 'activo',
          toppings: item.toppings && Array.isArray(item.toppings) ? item.toppings : []
        });
      }
      registrarLogABM("INYECCIÓN MASIVA", `Importados ${arrayProductos.length} productos.`);
      alert(`¡Catálogo masivo inyectado! (${arrayProductos.length} productos)`);
      setJsonMasivo('');
    } catch (e) {
      alert("Error: El formato del JSON es inválido.");
      console.error(e);
    }
  };

  const guardarVariablesRestaurante = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, `restaurantes/${tenantId}/configuracion`, "datos"), { 
      nombre: inputNombreRest, logoUrl: inputLogoUrl, colorPrincipal: inputColorPrincipal, colorSecundario: inputColorSecundario,
      direccion: inputDireccion, banco: inputBanco, cuenta: inputCuenta, titular: inputTitular, ruc: inputRuc, telefono: inputTelefono, moneda: inputMoneda 
    });
    alert("Variables de tienda guardadas.");
  };

  // RENDER PANTALLA LOGIN STAFF (SOFT UI)
  if (!user) {
    return (
      <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', maxWidth: '400px', margin: '80px auto', background: 'white', padding: '40px 30px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.03)', textAlign: 'center' }}>
        <div style={{ background: 'rgba(79, 70, 229, 0.1)', width: '70px', height: '70px', borderRadius: '20px', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
          <span style={{color: restauranteConfig?.colorPrincipal || '#4f46e5'}}>🔒</span>
        </div>
        <h3 style={{ marginTop: 0, color: '#111827', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Acceso Staff</h3>
        <p style={{ color: '#6b7280', fontSize: '15px', fontWeight: '500', marginBottom: '30px' }}>Ingresá con tu correo autorizado.</p>
        
        <form onSubmit={ejecutarLogin}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" style={{ width: '100%', padding: '18px', marginBottom: '15px', boxSizing: 'border-box', borderRadius: '16px', border: '2px solid transparent', background: '#f3f4f6', textAlign: 'center', fontSize: '15px', fontWeight: '600', outline: 'none', transition: '0.3s', color: '#111827' }} onFocus={(e) => {e.target.style.borderColor = restauranteConfig?.colorPrincipal || '#4f46e5'; e.target.style.background = 'white';}} onBlur={(e) => {e.target.style.borderColor = 'transparent'; e.target.style.background = '#f3f4f6';}} required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" style={{ width: '100%', padding: '18px', marginBottom: '25px', boxSizing: 'border-box', borderRadius: '16px', border: '2px solid transparent', background: '#f3f4f6', textAlign: 'center', fontSize: '15px', fontWeight: '600', outline: 'none', transition: '0.3s', color: '#111827' }} onFocus={(e) => {e.target.style.borderColor = restauranteConfig?.colorPrincipal || '#4f46e5'; e.target.style.background = 'white';}} onBlur={(e) => {e.target.style.borderColor = 'transparent'; e.target.style.background = '#f3f4f6';}} required />
          <button type="submit" style={{ width: '100%', padding: '18px', background: restauranteConfig?.colorPrincipal || '#4f46e5', color: obtenerColorTextoContraste(restauranteConfig?.colorPrincipal || '#4f46e5'), border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', transition: '0.3s' }} onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>
            Iniciar Sesión
          </button>
        </form>
      </div>
    );
  }

  // REGLA SAAS: SI EL NEGOCIO EXPIRÓ, EL STAFF CAE EN EL MURO DE PAGOS (SALVO TU CORREO MAESTRO)
  const esPropietarioSaaS = user?.email === 'aldojeda92@gmail.com';
  if (paywallBloqueado && !esPropietarioSaaS) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #fee2e2' }}>
        <span style={{ fontSize: '50px' }}>💳</span>
        <h2 style={{ color: '#111827', fontWeight: '900' }}>Período de Prueba Finalizado</h2>
        <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>Tu cuenta se encuentra suspendida temporalmente por límite de tiempo. Para reactivar el monitor de comandas, la caja y el menú QR, realiza la renovación del servicio.</p>
        <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '16px', marginBottom: '30px', textAlign: 'left', border: '1px solid #e5e7eb' }}>
          <strong style={{ display: 'block', color: '#111827', marginBottom: '10px' }}>Estructura del Plan Activado:</strong>
          • Costo de Implementación: <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>USD 100</span> <strong>USD 49 (Pago único)</strong><br/>
          • Suscripción Mensual Base: <strong>USD 1,99 / mes</strong> (Incluye 2 usuarios de Staff)<br/>
          • Usuario Extra: <strong>USD 0,90 / mes</strong>
        </div>
        <a href="https://dlocalgo.com/" target="_blank" rel="noreferrer" style={{ display: 'block', padding: '18px', background: '#10b981', color: 'white', borderRadius: '16px', fontWeight: '800', textDecoration: 'none', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)' }}>Pagar y Reactivar con dLocal Go</a>
      </div>
    );
  }

  // RENDER PANTALLA DE CARGA DE PERMISOS
  if (!permisos) {
    return <div style={{ textAlign: 'center', padding: '50px', fontSize: '20px', color: '#7f8c8d' }}>Validando credenciales y roles de seguridad...</div>;
  }

  // PRE-PROCESAMIENTO: CAJA (AGRUPACIÓN INDIVIDUAL)
  const mesasEnCaja = comandasCocina.filter(c => c.estado !== 'pagado').reduce((acc, curr) => {
    if (!acc[curr.mesa]) acc[curr.mesa] = { total: 0, comensales: {}, alertas: [] };
    acc[curr.mesa].total += (curr.total || 0);
    
    const persona = curr.comensal || 'Anónimo';
    if (!acc[curr.mesa].comensales[persona]) {
      acc[curr.mesa].comensales[persona] = { total: 0, items: [] };
    }
    
    acc[curr.mesa].comensales[persona].total += (curr.total || 0);
    if(curr.items && Array.isArray(curr.items)) {
      curr.items.forEach(item => {
        acc[curr.mesa].comensales[persona].items.push(item);
      });
    }
    return acc;
  }, {});

  if(alertasCaja && Array.isArray(alertasCaja)) {
    alertasCaja.filter(a => a.estado === 'pendiente_cobro').forEach(alerta => {
      if (!mesasEnCaja[alerta.mesa]) mesasEnCaja[alerta.mesa] = { total: 0, comensales: {}, alertas: [] };
      mesasEnCaja[alerta.mesa].alertas.push(alerta);
    });
  }

  // PRE-PROCESAMIENTO: DASHBOARD REPORTES TOP 5
  const ISO_START = fechaInicioRep + 'T00:00:00.000Z';
  const ISO_END = fechaFinRep + 'T23:59:59.999Z';
  const statsProductos = {};
  const statsToppings = {};
  const statsCombinaciones = {};

  const comandasPagadas = comandasCocina.filter(c => c.estado === 'pagado' && c.fecha >= ISO_START && c.fecha <= ISO_END);
  comandasPagadas.forEach(comanda => {
    comanda.items.forEach(item => {
      const prodEnCatalogo = inventario.find(p => p.id === item.id_prod);
      const categoriaReal = item.categoria || (prodEnCatalogo ? prodEnCatalogo.categoria : 'General');
      
      if (!statsProductos[item.nombre]) statsProductos[item.nombre] = { nombre: item.nombre, categoria: categoriaReal, cantidad: 0 };
      statsProductos[item.nombre].cantidad += item.cantidad;

      if(item.toppings){
        item.toppings.forEach(t => {
          if (!statsToppings[t.nombre]) statsToppings[t.nombre] = 0;
          statsToppings[t.nombre] += (t.cantidad * item.cantidad);
        });

        if (item.toppings.length > 0) {
          const nombreCombo = `${item.nombre} con ${item.toppings.map(t => t.nombre).join(', ')}`;
          if (!statsCombinaciones[nombreCombo]) statsCombinaciones[nombreCombo] = 0;
          statsCombinaciones[nombreCombo] += item.cantidad;
        }
      }
    });
  });

  const rankingPlatos = Object.values(statsProductos).filter(p => p.categoria !== 'Bebidas').sort((a,b) => b.cantidad - a.cantidad).slice(0,5);
  const rankingBebidas = Object.values(statsProductos).filter(p => p.categoria === 'Bebidas').sort((a,b) => b.cantidad - a.cantidad).slice(0,5);
  const rankingToppings = Object.entries(statsToppings).map(([nombre, cant]) => ({nombre, cant})).sort((a,b) => b.cant - a.cant).slice(0,5);
  const rankingCombos = Object.entries(statsCombinaciones).map(([nombre, cant]) => ({nombre, cant})).sort((a,b) => b.cant - a.cant).slice(0,5);

  // PRE-PROCESAMIENTO: COCINA (ITEMS INDIVIDUALES)
  const comandasFiltradas = comandasCocina.filter(p => {
    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'activos') return p.estado !== 'entregado' && p.estado !== 'pagado';
    if (filtroEstado === 'historial') return p.estado === 'entregado' || p.estado === 'pagado';
    return p.estado === filtroEstado;
  });

  const mesasEnCocina = comandasFiltradas.reduce((acc, curr) => {
    if (!acc[curr.mesa]) acc[curr.mesa] = { itemsNuevos: [], itemsCocina: [], itemsCompletados: [] };
    curr.items.forEach((item, idx) => {
      const est = item.estado_item || curr.estado; 
      const visualItem = { ...item, pedidoId: curr.id, comensal: curr.comensal, estado_doc: curr.estado, itemKey: item.id_item || idx };
      if (est === 'nuevo') acc[curr.mesa].itemsNuevos.push(visualItem);
      else if (est === 'cocina') acc[curr.mesa].itemsCocina.push(visualItem);
      else if (est === 'completado') acc[curr.mesa].itemsCompletados.push(visualItem);
    });
    return acc;
  }, {});


  return (
    <div style={{ padding: '20px', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      
      {/* NAVEGACIÓN SUPERIOR DEL STAFF */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {permisos?.cocina && <button onClick={() => setSubModulo('cocina')} style={{ padding: '12px 18px', background: subModulo === 'cocina' ? '#ef4444' : '#f3f4f6', color: subModulo === 'cocina' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px', transition: '0.3s' }}>🔥 COCINA</button>}
          {permisos?.caja && <button onClick={() => setSubModulo('caja')} style={{ padding: '12px 18px', background: subModulo === 'caja' ? '#10b981' : '#f3f4f6', color: subModulo === 'caja' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px', transition: '0.3s' }}>💰 CAJA ({Object.keys(mesasEnCaja).length})</button>}
          {permisos?.abm && <button onClick={() => setSubModulo('menu')} style={{ padding: '12px 18px', background: subModulo === 'menu' ? (restauranteConfig?.colorPrincipal || '#3b82f6') : '#f3f4f6', color: subModulo === 'menu' ? obtenerColorTextoContraste(restauranteConfig?.colorPrincipal) : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px', transition: '0.3s' }}>⚙ ABM Menú</button>}
          {permisos?.reportes && <button onClick={() => setSubModulo('reportes')} style={{ padding: '12px 18px', background: subModulo === 'reportes' ? '#8b5cf6' : '#f3f4f6', color: subModulo === 'reportes' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px', transition: '0.3s' }}>📊 REPORTES</button>}
          {permisos?.sistema && <button onClick={() => setSubModulo('config')} style={{ padding: '12px 18px', background: subModulo === 'config' ? '#f59e0b' : '#f3f4f6', color: subModulo === 'config' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px', transition: '0.3s' }}>🏢 Sistema</button>}
          {permisos?.admin && <button onClick={() => setSubModulo('staff')} style={{ padding: '12px 18px', background: subModulo === 'staff' ? '#111827' : '#f3f4f6', color: subModulo === 'staff' ? 'white' : '#111827', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px', transition: '0.3s' }}>👥 STAFF / ROLES</button>}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>👤 {user?.email}</span>
          <button onClick={() => signOut(auth)} style={{ padding: '10px 16px', background: 'transparent', color: '#ef4444', border: '2px solid #fee2e2', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', transition: '0.3s' }}>Salir</button>
        </div>
      </div>

      {/* RENDERIZADO: STAFF Y PERMISOS */}
      {subModulo === 'staff' && permisos?.admin && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Gestión de Personal vía Tickets</h2>
          
          <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '6px', marginBottom: '30px', border: '1px solid #ddd' }}>
            <strong style={{ display: 'block', marginBottom: '15px', color: '#2c3e50', fontSize: '16px' }}>➕ Solicitar Nuevo Acceso de Empleado (Ticket Virtual)</strong>
            <form onSubmit={enviarTicketAltaStaff}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <input type="email" value={nuevoEmailStaff} onChange={e => setNuevoEmailStaff(e.target.value)} placeholder="Correo del empleado (Ej. mozo@pasta.com)" style={{ flex: '2', minWidth: '260px', padding: '12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px' }} required />
                <button type="submit" style={{ flex: '1', minWidth: '150px', padding: '12px', background: restauranteConfig?.colorSecundario || '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Enviar Solicitud</button>
              </div>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', background: 'white', padding: '12px', borderRadius: '4px', border: '1px solid #eee' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555', display: 'block', width: '100%' }}>Asignar Roles Solicitados:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={permisoCocinaTemp} onChange={e => setPermisoCocinaTemp(e.target.checked)} /> 🔥 Cocina</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={permisoCajaTemp} onChange={e => setPermisoCajaTemp(e.target.checked)} /> 💰 Caja</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={permisoAbmTemp} onChange={e => setPermisoAbmTemp(e.target.checked)} /> ⚙ ABM Menú</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={permisoReportesTemp} onChange={e => setPermisoReportesTemp(e.target.checked)} /> 📊 Reportes</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="checkbox" checked={permisoSistemaTemp} onChange={e => setPermisoSistemaTemp(e.target.checked)} /> 🏢 Sistema</label>
              </div>
            </form>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: restauranteConfig?.colorPrincipal || '#2c3e50', color: 'white' }}>
                  <th style={{ padding: '12px' }}>Empleado</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>🔥 Cocina</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>💰 Caja</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>⚙ ABM</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>📊 Reps</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>🏢 Sist</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>👑 Admin Maestro</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Estado / Accion</th>
                </tr>
              </thead>
              <tbody>
                {usuariosStaff.map(u => {
                  const esPendienteAlta = u.estado_aprobacion === "pendiente_alta";
                  const esPendienteBaja = u.estado_aprobacion === "pendiente_baja";
                  const esActivo = !u.estado_aprobacion;

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #eee', background: esPendienteAlta ? '#fef9e7' : esPendienteBaja ? '#fdedec' : 'transparent' }}>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ display: 'block', color: '#34495e' }}>{u.email}</strong>
                        {u.admin && <span style={{ fontSize: '10px', color: '#8e44ad', fontWeight: 'bold' }}>👑 Propietario</span>}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={u.cocina || false} onChange={e => updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { cocina: e.target.checked })} disabled={!esActivo || u.admin} /></td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={u.caja || false} onChange={e => updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { caja: e.target.checked })} disabled={!esActivo || u.admin} /></td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={u.abm || false} onChange={e => updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { abm: e.target.checked })} disabled={!esActivo || u.admin} /></td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={u.reportes || false} onChange={e => updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { reportes: e.target.checked })} disabled={!esActivo || u.admin} /></td>
                      <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={u.sistema || false} onChange={e => updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { sistema: e.target.checked })} disabled={!esActivo || u.admin} /></td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input type="checkbox" checked={u.admin || false} onChange={e => {
                          if(window.confirm(e.target.checked ? "¿Dar poder total de Administrador Maestro a este usuario?" : "¿Quitar privilegios de Administrador Maestro?")) {
                             if(e.target.checked) updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { admin: true, cocina: true, caja: true, abm: true, reportes: true, sistema: true });
                             else updateDoc(doc(db, `restaurantes/${tenantId}/usuarios`, u.id), { admin: false });
                          }
                        }} style={{ transform: 'scale(1.5)' }} disabled={u.email === user?.email || !esActivo} />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {esPendienteAlta && <span style={{ background: '#f39c12', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>⏳ PENDIENTE ALTA</span>}
                        {esPendienteBaja && <span style={{ background: '#c0392b', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>⏳ PENDIENTE BAJA</span>}
                        {esActivo && !u.admin && (
                          <button onClick={() => enviarTicketBajaStaff(u)} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>❌ Dar de Baja</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDERIZADO: COCINA CON BOTONES INDIVIDUALES RESTAURADOS */}
      {subModulo === 'cocina' && permisos?.cocina && (
        <div>
          <div style={{ background: 'white', padding: '12px 15px', borderRadius: '6px', marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', marginRight: '10px', color: '#555' }}>Filtro Chef:</span>
            <button onClick={() => setFiltroEstado('activos')} style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #ccc', background: filtroEstado === 'activos' ? '#2c3e50' : '#f8f9fa', color: filtroEstado === 'activos' ? 'white' : '#333', borderRadius: '4px', fontWeight: 'bold' }}>Todas Activas</button>
            <button onClick={() => setFiltroEstado('historial')} style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #ccc', background: filtroEstado === 'historial' ? '#7f8c8d' : '#f8f9fa', color: filtroEstado === 'historial' ? 'white' : '#333', borderRadius: '4px', fontWeight: 'bold' }}>Historial (Ya servidos)</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {Object.keys(mesasEnCocina).map(mesaId => {
              const mesa = mesasEnCocina[mesaId];
              if (mesa.itemsNuevos.length === 0 && mesa.itemsCocina.length === 0 && mesa.itemsCompletados.length === 0) return null;

              const colorBorde = mesa.itemsNuevos.length > 0 ? '#e74c3c' : mesa.itemsCocina.length > 0 ? '#f39c12' : '#2ecc71';
              
              return (
                <div key={mesaId} style={{ background: 'white', padding: '20px', borderRadius: '8px', borderLeft: `8px solid ${colorBorde}`, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>MESA {mesaId}</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {mesa.itemsNuevos.length > 0 && <span style={{ background: '#e74c3c', color: 'white', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>NUEVOS PENDIENTES</span>}
                      {mesa.itemsCocina.length > 0 && <span style={{ background: '#f39c12', color: 'white', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>EN EL FUEGO</span>}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    {mesa.itemsNuevos.map((item, idx) => (
                      <div key={`n-${idx}`} style={{ padding: '12px', background: '#fdedec', borderLeft: `4px solid #e74c3c`, marginBottom: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px' }}><strong>{item.cantidad}x {item.nombre}</strong> <span style={{ fontSize: '12px', color: '#7f8c8d' }}>(De: {item.comensal || 'Anónimo'})</span></div>
                          {item.toppings && item.toppings.length > 0 && <div style={{ fontSize: '12px', color: '#e74c3c', paddingLeft: '10px', marginTop: '4px' }}>↳ Extras: {item.textToppings}</div>}
                        </div>
                        <button onClick={() => avanzarEstadoItem(item.pedidoId, item.itemKey, 'cocina')} style={{ background: '#f39c12', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', marginLeft: '10px', flexShrink: 0 }}>Cocinar 🍳</button>
                      </div>
                    ))}
                    {mesa.itemsCocina.map((item, idx) => (
                      <div key={`c-${idx}`} style={{ padding: '12px', background: '#fef5e7', borderLeft: `4px solid #f39c12`, marginBottom: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px' }}><strong>{item.cantidad}x {item.nombre}</strong> <span style={{ fontSize: '12px', color: '#7f8c8d' }}>(De: {item.comensal || 'Anónimo'})</span></div>
                          {item.toppings && item.toppings.length > 0 && <div style={{ fontSize: '12px', color: '#f39c12', paddingLeft: '10px', marginTop: '4px' }}>↳ Extras: {item.textToppings}</div>}
                        </div>
                        <button onClick={() => avanzarEstadoItem(item.pedidoId, item.itemKey, 'completado')} style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', marginLeft: '10px', flexShrink: 0 }}>Listo! 🛎️</button>
                      </div>
                    ))}
                    {mesa.itemsCompletados.map((item, idx) => (
                      <div key={`d-${idx}`} style={{ padding: '12px', background: '#eafaf1', borderLeft: `4px solid #2ecc71`, marginBottom: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px' }}><strong>{item.cantidad}x {item.nombre}</strong> <span style={{ fontSize: '12px', color: '#7f8c8d' }}>(De: {item.comensal || 'Anónimo'})</span></div>
                          {item.toppings && item.toppings.length > 0 && <div style={{ fontSize: '12px', color: '#2ecc71', paddingLeft: '10px', marginTop: '4px' }}>↳ Extras: {item.textToppings}</div>}
                        </div>
                        <button onClick={() => avanzarEstadoItem(item.pedidoId, item.itemKey, 'entregado')} style={{ background: '#7f8c8d', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', marginLeft: '10px', flexShrink: 0 }}>Entregado 🏃</button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                    {mesa.itemsNuevos.length > 0 && <button onClick={() => avanzarBloqueMesa(mesaId, 'nuevo', 'cocina')} style={{ width: '100%', background: '#f39c12', color: 'white', border: 'none', padding: '12px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>Marchar todos los Nuevos (Toda la mesa)</button>}
                    {mesa.itemsCocina.length > 0 && <button onClick={() => avanzarBloqueMesa(mesaId, 'cocina', 'completado')} style={{ width: '100%', background: '#2ecc71', color: 'white', border: 'none', padding: '12px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>Platos en fuego Listos (Toda la mesa)</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RENDERIZADO: CAJA DESGLOSADA POR COMENSAL */}
      {subModulo === 'caja' && permisos?.caja && (
        <div>
          <h2>💰 Monitor de Caja y Cuentas Activas</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {Object.keys(mesasEnCaja).map(mesaId => {
              const infoMesa = mesasEnCaja[mesaId];
              const tieneAlerta = infoMesa.alertas.length > 0;
              const alertaActiva = tieneAlerta ? infoMesa.alertas[0] : null;

              return (
                <div key={mesaId} style={{ background: tieneAlerta ? '#e8f6f3' : 'white', padding: '20px', borderRadius: '8px', borderLeft: tieneAlerta ? '10px solid #27ae60' : '10px solid #f39c12', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>MESA {mesaId}</span>
                    <span style={{ background: tieneAlerta ? '#27ae60' : '#f39c12', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                      {tieneAlerta ? 'PIDE CUENTA' : 'CONSUMIENDO'}
                    </span>
                  </div>
                  
                  {tieneAlerta && (
                    <div style={{ marginBottom: '15px', padding: '12px', background: '#d4edda', borderRadius: '4px', color: '#155724', fontSize: '15px', border: '1px solid #c3e6cb' }}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Modo de Cobro: {alertaActiva.tipo_division === 'separadas' ? 'CUENTAS SEPARADAS' : `PAGA TODO ${(alertaActiva.solicitante || '').toUpperCase()}`}</strong>
                      Llevar POS / Medio: <strong>{(alertaActiva.metodo_solicitado || '').toUpperCase()}</strong>
                      
                      <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.6)', padding: '8px', borderRadius: '4px', fontSize: '13px' }}>
                        <strong>🧾 Info Facturación:</strong><br/>
                        {typeof alertaActiva.facturacion === 'object' ? `RUC: ${alertaActiva.facturacion.ruc} | Nombre: ${alertaActiva.facturacion.nombre}` : alertaActiva.facturacion}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px', fontSize: '15px' }}>
                    <strong style={{ display: 'block', marginBottom: '10px', color: '#7f8c8d', borderBottom: '1px solid #f1f2f6', paddingBottom: '4px' }}>Detalle de Consumos por Usuario:</strong>
                    
                    {Object.keys(infoMesa.comensales).map(persona => (
                      <div key={persona} style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px', background: '#f8f9fa', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${restauranteConfig?.colorSecundario || '#3498db'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: '#2980b9' }}>👤 {persona}</span>
                          <strong style={{ color: '#2c3e50' }}>{divisa} {(infoMesa.comensales[persona].total || 0).toLocaleString()}</strong>
                        </div>
                        {infoMesa.comensales[persona].items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: '12px', color: '#555', paddingLeft: '8px', marginBottom: '2px' }}>
                            • {it.cantidad}x {it.nombre} {divisa} {(it.precio_unitario || 0).toLocaleString()}
                            {it.toppings && it.toppings.length > 0 && <span style={{ color: '#7f8c8d', display: 'block', fontSize: '10px', paddingLeft: '8px' }}>↳ Extras: {it.textToppings}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                    
                    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginTop: '15px', textAlign: 'center', border: '1px solid #ddd' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#7f8c8d', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px' }}>
                        <span>SUBTOTAL MESA:</span>
                        <strong style={{ color: '#333' }}>{divisa} {(infoMesa.total || 0).toLocaleString()}</strong>
                      </div>
                      {tieneAlerta && (alertaActiva.propina_monto || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#e67e22', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px' }}>
                          <span>PROPINA ADICIONAL ({alertaActiva.propina_pct}%):</span>
                          <strong>+ {divisa} {(alertaActiva.propina_monto || 0).toLocaleString()}</strong>
                        </div>
                      )}
                      <span style={{ display: 'block', fontSize: '11px', color: '#7f8c8d', marginTop: '10px' }}>{tieneAlerta && alertaActiva.tipo_division === 'separadas' ? `A COBRAR SOLO A ${alertaActiva.solicitante.toUpperCase()}` : 'TOTAL A COBRAR (TODA LA MESA)'}</span>
                      <strong style={{ display: 'block', fontSize: '26px', color: '#27ae60' }}>{divisa} {((tieneAlerta ? alertaActiva.total_final : infoMesa.total) || 0).toLocaleString()}</strong>
                    </div>
                  </div>

                  <button onClick={() => facturarMesaCaja(mesaId, alertaActiva)} style={{ width: '100%', padding: '15px', background: restauranteConfig?.colorPrincipal || '#2c3e50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {tieneAlerta && alertaActiva.tipo_division === 'separadas' ? `Cobrar individual a ${alertaActiva.solicitante}` : 'Confirmar Pago Total y Liberar Mesa'}
                  </button>
                </div>
              );
            })}
            
            {Object.keys(mesasEnCaja).length === 0 && (
              <p style={{ color: '#7f8c8d', fontSize: '18px' }}>Ninguna mesa tiene deudas pendientes.</p>
            )}
          </div>
        </div>
      )}

      {/* RENDERIZADO: ABM Y AUDITORÍA */}
      {subModulo === 'menu' && permisos?.abm && (
        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderTop: idEditando ? `4px solid ${restauranteConfig?.colorSecundario || '#3498db'}` : 'none' }}>
                <h3 style={{ marginTop: 0, color: idEditando ? (restauranteConfig?.colorSecundario || '#3498db') : '#333' }}>{idEditando ? '✏ Editando Producto' : 'Formulario ABM Manual'}</h3>
                <form onSubmit={guardarMenuEnFirebase}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Nombre del Plato</label>
                  <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Lasaña Clásica" style={{ width: '100%', padding: '12px', marginBottom: '15px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}/>
                  
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Precio Base</label>
                      <input type="number" value={precioBase} onChange={e => setPrecioBase(e.target.value)} placeholder={divisa} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#e74c3c' }}>Precio Promocional</label>
                      <input type="number" value={precioPromo} onChange={e => setPrecioPromo(e.target.value)} placeholder="Opcional (Tacha base)" style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #e74c3c' }}/>
                    </div>
                  </div>

                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>URL de Imagen (Opcional)</label>
                  <input type="text" value={imagenUrl} onChange={e => setImagenUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '12px', marginBottom: '15px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}/>
                  
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Categoría / Etiqueta</label>
                  <select value={categoriaSelect} onChange={e => setCategoriaSelect(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="Plato Principal">Plato Principal</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Postres">Postres</option>
                    <option value="Entradas">Entradas</option>
                    <option value="Pizzas">Pizzas</option>
                    <option value="General">General (Otros)</option>
                  </select>

                  <div style={{ background: '#f0f2f5', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                    <h4 style={{ marginTop: 0 }}>Toppings u Opcionales</h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'stretch' }}>
                      <input type="text" placeholder="Ej. Queso Extra" value={toppingNombre} onChange={e => setToppingNombre(e.target.value)} style={{ flex: '1 1 50%', padding: '10px', boxSizing: 'border-box', minWidth: '0', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <input type="number" placeholder={divisa} value={toppingPrecio} onChange={e => setToppingPrecio(e.target.value)} style={{ flex: '1 1 30%', padding: '10px', boxSizing: 'border-box', minWidth: '0', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <button type="button" onClick={agregarToppingAlListadoTemporal} style={{ flex: '0 0 auto', background: restauranteConfig?.colorSecundario || '#3498db', color: 'white', border: 'none', padding: '0 20px', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', fontSize: '20px' }}>+</button>
                    </div>
                    <ul style={{ paddingLeft: '20px', margin: '10px 0 0 0' }}>
                      {toppingsLista.map((t, i) => (
                        <li key={i} style={{ fontSize: '14px', marginBottom: '6px' }}>{t.nombre} (+ {divisa} {(t.precio || 0).toLocaleString()}) <button type="button" onClick={() => eliminarToppingTemporal(i)} style={{ background: 'none', border: 'none', color: '#e74c3c', marginLeft: '10px', cursor: 'pointer', fontWeight: 'bold' }}>[X]</button></li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" style={{ flex: 1, padding: '15px', background: idEditando ? (restauranteConfig?.colorSecundario || '#3498db') : '#2ecc71', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '6px' }}>{idEditando ? 'Actualizar Plato' : 'Guardar Manual'}</button>
                    {idEditando && <button type="button" onClick={cancelarEdicion} style={{ padding: '15px', background: '#e74c3c', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '6px' }}>Cancelar</button>}
                  </div>
                </form>
              </div>

              <div style={{ background: '#fff3cd', padding: '25px', borderRadius: '8px', border: '1px solid #ffeeba', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0, color: '#856404' }}>🚀 Inyector Masivo (JSON)</h3>
                <textarea value={jsonMasivo} onChange={e => setJsonMasivo(e.target.value)} placeholder={`[\n  {"nombre": "Cola", "precio_base": 12000, "categoria": "Bebidas", "toppings": []}\n]`} style={{ width: '100%', height: '100px', padding: '10px', boxSizing: 'border-box', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }} />
                <button onClick={procesarInyeccionMasiva} style={{ width: '100%', padding: '15px', background: '#e67e22', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', borderRadius: '6px' }}>Procesar Catálogo</button>
              </div>
            </div>

            <div style={{ flex: '1.5', minWidth: '360px', background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Catálogo Activo</h3>
              {inventario.map(prod => (
                <div key={prod.id} style={{ borderBottom: '1px solid #eee', padding: '15px 0', opacity: prod.estado === 'inactivo' ? 0.4 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {prod.imagenUrl ? (
                      <img src={prod.imagenUrl} alt={prod.nombre} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', background: '#eee' }} />
                    ) : (
                      <div style={{ width: '60px', height: '60px', background: '#f4f6f8', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdc3c7', fontWeight: 'bold', fontSize: '20px' }}>{prod.nombre.charAt(0)}</div>
                    )}
                    <div>
                      <span style={{ fontSize: '10px', background: '#eee', padding: '3px 6px', borderRadius: '3px', color: '#777', display: 'inline-block', marginBottom: '4px' }}>{prod.categoria || 'General'}</span>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#2c3e50' }}>{prod.nombre}</strong>
                      {prod.precio_promo > 0 ? (
                        <span style={{ display: 'block', color: '#e74c3c', fontWeight: 'bold', fontSize: '14px' }}>
                          <span style={{ textDecoration: 'line-through', color: '#95a5a6', marginRight: '5px', fontSize: '12px' }}>{divisa} {(prod.precio_base || 0).toLocaleString()}</span>
                          {divisa} {prod.precio_promo.toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ display: 'block', color: '#27ae60', fontWeight: 'bold', fontSize: '14px' }}>{divisa} {(prod.precio_base || 0).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => iniciarEdicion(prod)} style={{ padding: '8px 12px', cursor: 'pointer', background: restauranteConfig?.colorSecundario || '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Editar</button>
                    <button onClick={() => cambiarEstadoVisibilidadProducto(prod)} style={{ padding: '8px 12px', cursor: 'pointer', background: prod.estado === 'activo' ? '#f39c12' : '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>{prod.estado === 'activo' ? 'Pausar' : 'Activar'}</button>
                    <button onClick={() => borrarProductoDefinitivo(prod)} style={{ padding: '8px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '10px' }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>🔐 Auditoría de Cambios en Catálogo</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Fecha y Hora</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Usuario Responsable</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Acción Ejecutada</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Detalle / Plato Afectado</th>
                </tr>
              </thead>
              <tbody>
                {logsABM.length === 0 ? <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#7f8c8d' }}>No hay registros recientes.</td></tr> : null}
                {logsABM.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{new Date(log.fecha).toLocaleString()}</td>
                    <td style={{ padding: '10px', color: '#2980b9', fontWeight: 'bold' }}>{log.usuario}</td>
                    <td style={{ padding: '10px' }}><span style={{ background: log.accion === 'ALTA' ? '#2ecc71' : log.accion.includes('ELIMINA') ? '#e74c3c' : log.accion === 'MODIFICACIÓN' ? '#f39c12' : '#95a5a6', color: 'white', padding: '3px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>{log.accion}</span></td>
                    <td style={{ padding: '10px' }}>{log.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDERIZADO: REPORTES Y DASHBOARD */}
      {subModulo === 'reportes' && permisos?.reportes && (
        <div style={{ maxWidth: '1000px', margin: '0 auto', background: 'transparent' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
            <h2 style={{ marginTop: 0, color: '#8e44ad', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>📈 Rendimiento y Facturación Bruta</h2>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '30px', background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Desde:</label>
                <input type="date" value={fechaInicioRep} onChange={e => setFechaInicioRep(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Hasta:</label>
                <input type="date" value={fechaFinRep} onChange={e => setFechaFinRep(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
            </div>

            {(() => {
              const ticketsCobrados = alertasCaja.filter(c => c.estado === 'pagado' && c.fecha >= ISO_START && c.fecha <= ISO_END);
              const totalFacturado = ticketsCobrados.reduce((acc, c) => acc + (c.total_final || 0), 0);
              const propinasGeneradas = ticketsCobrados.reduce((acc, c) => acc + (c.propina_monto || 0), 0);
              const subtotalRestaurante = ticketsCobrados.reduce((acc, c) => acc + (c.subtotal || 0), 0);

              return (
                <div>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px', background: restauranteConfig?.colorPrincipal || '#2c3e50', color: 'white', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '14px', color: '#bdc3c7', marginBottom: '10px' }}>TOTAL BRUTO FACTURADO</span>
                      <strong style={{ display: 'block', fontSize: '36px' }}>{divisa} {(totalFacturado || 0).toLocaleString()}</strong>
                    </div>
                    <div style={{ flex: '1 1 300px', background: restauranteConfig?.colorSecundario || '#e67e22', color: 'white', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '14px', color: '#f3e5ab', marginBottom: '10px' }}>MESAS COBRADAS (VOLUMEN)</span>
                      <strong style={{ display: 'block', fontSize: '36px' }}>{ticketsCobrados.length}</strong>
                    </div>
                  </div>

                  <div style={{ background: '#fdfefe', border: '1px solid #ebedef', padding: '20px', borderRadius: '6px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#7f8c8d' }}>Desglose de Ingresos Financieros</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #ccc', paddingBottom: '8px', marginBottom: '8px', fontSize: '16px' }}>
                      <span>Ingreso Genuino Restaurante (Comida):</span>
                      <strong>{divisa} {(subtotalRestaurante || 0).toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#27ae60' }}>
                      <span>Propinas Staff (Fondo para empleados):</span>
                      <strong>+ {divisa} {(propinasGeneradas || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <h2 style={{ marginTop: 0, color: '#3498db', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>🏆 Rankings de Ventas Globales (Top 5)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '25px' }}>
              
              <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fa', padding: '15px', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #eee' }}>🍝 Platos Principales Más Solicitados</div>
                <div style={{ padding: '15px' }}>
                  {rankingPlatos.length === 0 ? <p style={{color:'#999'}}>Sin datos suficientes.</p> : rankingPlatos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                      <span><strong>{i+1}.</strong> {p.nombre}</span> <span style={{ background: '#eafaf1', color: '#27ae60', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{p.cantidad} und.</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fa', padding: '15px', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #eee' }}>🍹 Bebidas Más Solicitadas</div>
                <div style={{ padding: '15px' }}>
                  {rankingBebidas.length === 0 ? <p style={{color:'#999'}}>Sin datos suficientes.</p> : rankingBebidas.map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                      <span><strong>{i+1}.</strong> {b.nombre}</span> <span style={{ background: '#ebf5fb', color: '#2980b9', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{b.cantidad} und.</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fa', padding: '15px', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #eee' }}>🧀 Toppings / Guarniciones Más Vendidos</div>
                <div style={{ padding: '15px' }}>
                  {rankingToppings.length === 0 ? <p style={{color:'#999'}}>Sin datos suficientes.</p> : rankingToppings.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                      <span><strong>{i+1}.</strong> {t.nombre}</span> <span style={{ background: '#fef5e7', color: '#f39c12', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{t.cant} extras</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fa', padding: '15px', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #eee' }}>⭐ Combinaciones Estrella (Plato + Topping)</div>
                <div style={{ padding: '15px' }}>
                  {rankingCombos.length === 0 ? <p style={{color:'#999'}}>Sin datos suficientes.</p> : rankingCombos.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                      <span style={{ fontSize: '13px', lineHeight: '1.4' }}><strong>{i+1}.</strong> {c.nombre}</span> <span style={{ background: '#f5eef8', color: '#8e44ad', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', height: 'fit-content' }}>{c.cant} und.</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* RENDERIZADO: CONFIGURACIÓN GENERAL */}
      {subModulo === 'config' && permisos?.sistema && (
        <div style={{ maxWidth: '600px', background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <h3 style={{ marginTop: 0, color: '#111827', fontWeight: '900' }}>🏢 Variables Operativas del Local</h3>
          <form onSubmit={guardarVariablesRestaurante}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <label style={{ flex: 1, fontWeight: '700' }}>Nombre Comercial:<input type="text" value={inputNombreRest} onChange={e => setInputNombreRest(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} required /></label>
              
              {/* SELECTOR DE MONEDA DE EXPORTACIÓN (PUNTO B) */}
              <label style={{ flex: 1, fontWeight: '700' }}>Moneda del Catálogo:<br/>
                <select value={inputMoneda} onChange={e => setInputMoneda(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', fontWeight: '700', boxSizing: 'border-box' }}>
                  <option value="Gs.">Gs. (Paraguay)</option>
                  <option value="USD">USD (Dólares)</option>
                  <option value="ARS">ARS (Argentina)</option>
                  <option value="R$">R$ (Brasil)</option>
                  <option value="MXN">MXN (México)</option>
                  <option value="COP">COP (Colombia)</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>URL del Logo:<input type="text" value={inputLogoUrl} onChange={e => setInputLogoUrl(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} /></label>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <label style={{ flex: 1, fontWeight: '700' }}>Color Menú (Barra Sup.):<br/><input type="color" value={inputColorPrincipal} onChange={e => setInputColorPrincipal(e.target.value)} style={{ width: '100%', height: '45px', marginTop: '5px', cursor: 'pointer', border: 'none', borderRadius: '12px' }} /></label>
              <label style={{ flex: 1, fontWeight: '700' }}>Color Botones (Acción):<br/><input type="color" value={inputColorSecundario} onChange={e => setInputColorSecundario(e.target.value)} style={{ width: '100%', height: '45px', marginTop: '5px', cursor: 'pointer', border: 'none', borderRadius: '12px' }} /></label>
            </div>

            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>Dirección:<input type="text" value={inputDireccion} onChange={e => setInputDireccion(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} required /></label>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>Teléfono:<input type="text" value={inputTelefono} onChange={e => setInputTelefono(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} required /></label>
            
            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginTop: '25px', color: restauranteConfig?.colorPrincipal || '#2c3e50' }}>Datos para Transferencias (Caja)</h4>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>Banco:<input type="text" value={inputBanco} onChange={e => setInputBanco(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} /></label>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>Nro Cuenta:<input type="text" value={inputCuenta} onChange={e => setInputCuenta(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} /></label>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>Titular:<input type="text" value={inputTitular} onChange={e => setInputTitular(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} /></label>
            <label style={{ display: 'block', marginBottom: '25px', fontWeight: '700' }}>RUC:<input type="text" value={inputRuc} onChange={e => setInputRuc(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', boxSizing: 'border-box' }} /></label>
            
            <button type="submit" style={{ width: '100%', padding: '18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '16px' }}>Guardar Cambios Operativos</button>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE NUEVO: PANEL SUPER ADMIN SAAS
// ==========================================
function SuperAdminDashboard() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantesBD, setRestaurantesBD] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados temporales de edición rápida
  const [editandoTenant, setEditandoTenant] = useState(null);
  const [tempEstado, setTempEstado] = useState('');
  const [tempFecha, setTempFecha] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email === 'aldojeda92@gmail.com') {
        cargarTodosLosRestaurantes();
      } else {
        setCargando(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const cargarTodosLosRestaurantes = async () => {
    setCargando(true);
    try {
      // Escanea absolutamente todas las configuraciones en Firebase
      const querySnapshot = await getDocs(collectionGroup(db, 'configuracion'));
      const lista = [];
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === 'datos') {
          const idInquilino = docSnap.ref.parent.parent.id;
          lista.push({ id_tenant: idInquilino, ...docSnap.data() });
        }
      });
      setRestaurantesBD(lista);
    } catch (error) {
      console.error("Error cargando panel maestro:", error);
      alert("Error al cargar la base de datos. Verifica reglas de Firebase.");
    }
    setCargando(false);
  };

  const ejecutarLoginAdmin = async (e) => {
    e.preventDefault();
    try { 
      await signInWithEmailAndPassword(auth, email, password); 
    } catch (error) { 
      alert("Credenciales incorrectas."); 
    }
  };

  const iniciarEdicionRapida = (rest) => {
    setEditandoTenant(rest.id_tenant);
    setTempEstado(rest.estadoSuscripcion || 'demo');
    setTempFecha(rest.fechaFinDemo || new Date().toISOString().split('T')[0]);
  };

  const guardarEdicionRapida = async (id_tenant) => {
    try {
      await updateDoc(doc(db, `restaurantes/${id_tenant}/configuracion`, 'datos'), {
        estadoSuscripcion: tempEstado,
        fechaFinDemo: tempFecha
      });
      alert(`✅ Licencia de ${id_tenant} actualizada.`);
      setEditandoTenant(null);
      cargarTodosLosRestaurantes(); // Refrescar lista
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  if (cargando) return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Conectando a la central...</div>;

  if (!user) {
    return (
      <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: '#111827', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1f2937', padding: '40px 30px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', border: '1px solid #374151' }}>
          <span style={{ fontSize: '40px' }}>👑</span>
          <h2 style={{ color: 'white', fontWeight: '900', marginTop: '10px' }}>Master Resto SaaS</h2>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '30px' }}>Solo personal autorizado.</p>
          
          <form onSubmit={ejecutarLoginAdmin}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Operador" style={{ width: '100%', padding: '16px', marginBottom: '15px', borderRadius: '12px', background: '#374151', border: 'none', color: 'white', textAlign: 'center', outline: 'none' }} required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña Maestra" style={{ width: '100%', padding: '16px', marginBottom: '25px', borderRadius: '12px', background: '#374151', border: 'none', color: 'white', textAlign: 'center', outline: 'none' }} required />
            <button type="submit" style={{ width: '100%', padding: '18px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', transition: '0.3s' }}>Acceder a la Central</button>
          </form>
        </div>
      </div>
    );
  }

  // SI SE LOGUEA ALGUIEN QUE NO SOS VOS, REBOTA.
  if (user.email !== 'aldojeda92@gmail.com') {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#ef4444' }}>Acceso Denegado</h2>
        <p>Tu cuenta ({user.email}) no tiene privilegios de Operador SaaS.</p>
        <button onClick={() => signOut(auth)} style={{ padding: '10px 20px', background: '#111827', color: 'white', borderRadius: '8px' }}>Cerrar Sesión</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* CABECERA SUPER ADMIN */}
        <div style={{ background: '#111827', color: 'white', padding: '30px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: '900', color: '#c4b5fd' }}>👑 Cuartel General SaaS</h1>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>Control global de infraestructura y licencias de Master Resto.</span>
          </div>
          <button onClick={() => signOut(auth)} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>Salir de Central</button>
        </div>

        {/* TABLA DE INQUILINOS */}
        <div style={{ background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '20px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#111827', fontWeight: '900' }}>Inquilinos Activos ({restaurantesBD.length})</h2>
            <button onClick={cargarTodosLosRestaurantes} style={{ padding: '10px 16px', background: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>🔄 Refrescar Red</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#6b7280', fontSize: '13px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '15px' }}>Tenant ID (Subdominio)</th>
                  <th style={{ padding: '15px' }}>Nombre Comercial</th>
                  <th style={{ padding: '15px' }}>Divisa</th>
                  <th style={{ padding: '15px' }}>Estado SaaS</th>
                  <th style={{ padding: '15px' }}>Fin de Licencia</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>Acción Remota</th>
                </tr>
              </thead>
              <tbody>
                {restaurantesBD.map((rest, idx) => {
                  const esEditando = editandoTenant === rest.id_tenant;
                  const estadoColor = rest.estadoSuscripcion === 'activo' ? '#10b981' : rest.estadoSuscripcion === 'suspendido' ? '#ef4444' : '#f59e0b';
                  
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', transition: '0.2s' }}>
                      <td style={{ padding: '15px', fontWeight: '700', color: '#4f46e5' }}>{rest.id_tenant}</td>
                      <td style={{ padding: '15px', fontWeight: '700', color: '#111827' }}>{rest.nombre || 'Sin configurar'}</td>
                      <td style={{ padding: '15px', fontWeight: '600', color: '#6b7280' }}>{rest.moneda || 'Gs.'}</td>
                      
                      <td style={{ padding: '15px' }}>
                        {esEditando ? (
                          <select value={tempEstado} onChange={e => setTempEstado(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                            <option value="demo">Demo</option>
                            <option value="activo">Activo</option>
                            <option value="suspendido">Suspendido</option>
                          </select>
                        ) : (
                          <span style={{ background: `${estadoColor}20`, color: estadoColor, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' }}>
                            {rest.estadoSuscripcion || 'Desconocido'}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '15px' }}>
                        {esEditando ? (
                          <input type="date" value={tempFecha} onChange={e => setTempFecha(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                        ) : (
                          <span style={{ fontWeight: '600', color: '#4b5563' }}>{rest.fechaFinDemo || 'Sin Límite'}</span>
                        )}
                      </td>

                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        {esEditando ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => guardarEdicionRapida(rest.id_tenant)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Guardar</button>
                            <button onClick={() => setEditandoTenant(null)} style={{ background: '#f3f4f6', color: '#4b5563', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>X</button>
                          </div>
                        ) : (
                          <button onClick={() => iniciarEdicionRapida(rest)} style={{ background: 'transparent', color: '#8b5cf6', border: '1px solid #8b5cf6', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: '0.2s' }}>Editar Licencia</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {restaurantesBD.length === 0 && (
                  <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>No hay restaurantes registrados en Firebase.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
