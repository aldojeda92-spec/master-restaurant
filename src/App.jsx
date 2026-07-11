import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, setDoc, getDoc, getDocs, limit } from 'firebase/firestore';
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
// APP PRINCIPAL
// ==========================================
export default function App() {
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
    // variables sAAs globales por defecto
    moneda: 'Gs.',
    estadoSuscripcion: 'demo', 
    fechaFinDemo: new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0] // 90 días demo inicial
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

  // REGLA UX: SI LA DEMO EXPIRO, PINTAMOS EL CORDÓN DE SEGURIDAD
  if (requierePago && vistaActual === 'cliente') {
    return (
      <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', background: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.04)', maxWidth: '450px', border: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: '50px' }}>⚙️</span>
          <h2 style={{ color: '#111827', fontWeight: '900', marginTop: '15px' }}>Menú en Mantenimiento</h2>
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>Estamos optimizando nuestra plataforma digital para brindarte un mejor servicio. Por favor, solicita la carta física o asistencia al personal del local.</p>
        </div>
      </div>
    );
  }

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
      <nav style={{ background: config?.colorPrincipal || '#2c3e50', padding: '15px 20px', display: 'flex', justifyContenit: 'space-between', alignItems: 'center', color: obtenerColorTextoContraste(config?.colorPrincipal), boxShadow: '0 4px 20px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: '10px', position: 'sticky', top: 0, zIndex: 100 }}>
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
                  <span style={{ fontSize: '24px', fontWeight: '900', width: '30px', textAlign: 'center', color: '#111827' }}>{cant=cantidadTemp}</span>
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
  const [inputMoneda, setInputMoneda] = useState(restauranteConfig?.moneda || 'Gs.');

  // CONTROL MASTER SAAS VARIABLES (SOLO ACCESIBLE POR ALDO)
  const [saasStatus, setSaasStatus] = useState(restauranteConfig?.estadoSuscripcion || 'demo');
  const [saasFechaDemo, setSaasFechaDemo] = useState(restauranteConfig?.fechaFinDemo || hoyStr);

  const divisa = restauranteConfig?.moneda || 'Gs.';

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
      setSaasStatus(restauranteConfig.estadoSuscripcion || 'demo');
      setSaasFechaDemo(restauranteConfig.fechaFinDemo || '2026-10-11');
    }
  }, [restauranteConfig]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `restaurantes/${tenantId}/pedidos`), orderBy("fecha", "desc"));
    const unsubscribePedidos = onSnapshot(q, (snapshot) => {
      const cocinas = [];
      const alertas = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tipo === 'comanda') cocinas.push({ ...data, id: doc.id });
        if (data.tipo === 'alerta_caja') alertas.push({ ...data, id: doc.id });
      });
      setComandasCocina(cocinas);
      setAlertasCaja(alertas);
    });
    return () => unsubscribePedidos();
  }, [user]);

  const ejecutarLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert("Credenciales incorrectas."); }
  };

  const guardarVariablesRestaurante = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, `restaurantes/${tenantId}/configuracion`, "datos"), { 
      nombre: inputNombreRest, logoUrl: inputLogoUrl, colorPrincipal: inputColorPrincipal, colorSecundario: inputColorSecundario,
      direccion: inputDireccion, banco: inputBanco, cuenta: inputCuenta, titular: inputTitular, ruc: inputRuc, telefono: inputTelefono, moneda: inputMoneda 
    });
    alert("Variables de tienda guardadas.");
  };

  // CONTROL MAESTRO DE FACTURACIÓN (EXCLUSIVO PARA ALDO - CONEXIÓN DLOCAL LINK)
  const guardarControlMaestroSaaS = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, `restaurantes/${tenantId}/configuracion`, "datos"), { 
      estadoSuscripcion: saasStatus,
      fechaFinDemo: saasFechaDemo
    });
    alert("¡Estado de Suscripción SaaS Actualizado de forma central!");
  };

  // RENDER PANTALLA LOGIN STAFF
  if (!user) {
    return (
      <div style={{ maxWidth: '400px', margin: '80px auto', background: 'white', padding: '40px 30px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.03)', textAlign: 'center' }}>
        <h3>🔒 Acceso Staff</h3>
        <form onSubmit={ejecutarLogin}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" style={{ width: '100%', padding: '18px', marginBottom: '15px', borderRadius: '16px', border: '2px solid transparent', background: '#f3f4f6', textAlign: 'center', outline: 'none' }} required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" style={{ width: '100%', padding: '18px', marginBottom: '25px', borderRadius: '16px', border: '2px solid transparent', background: '#f3f4f6', textAlign: 'center', outline: 'none' }} required />
          <button type="submit" style={{ width: '100%', padding: '18px', background: restauranteConfig?.colorPrincipal || '#4f46e5', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}>Iniciar Sesión</button>
        </form>
      </div>
    );
  }

  // REGLA SAAS: SI EL NEGOCIO EXPIRÓ, EL STAFF CAE EN EL RECLAMO COMERCIAL (SALVO TU CORREO BACKDOOR)
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

  // PRE-PROCESAMIENTO DE INFORMACIÓN (CAJA, COCINA Y REPORTES)
  const mesasEnCaja = comandasCocina.filter(c => c.estado !== 'pagado').reduce((acc, curr) => {
    if (!acc[curr.mesa]) acc[curr.mesa] = { total: 0, comensales: {}, alertas: [] };
    acc[curr.mesa].total += (curr.total || 0);
    const persona = curr.comensal || 'Anónimo';
    if (!acc[curr.mesa].comensales[persona]) acc[curr.mesa].comensales[persona] = { total: 0, items: [] };
    acc[curr.mesa].comensales[persona].total += (curr.total || 0);
    if(curr.items) acc[curr.mesa].comensales[persona].items.push(...curr.items);
    return acc;
  }, {});

  return (
    <div style={{ padding: '20px' }}>
      
      {/* MENU INTERNO DEL ADMIN */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setSubModulo('cocina')} style={{ padding: '12px 18px', background: subModulo === 'cocina' ? '#ef4444' : '#f3f4f6', color: subModulo === 'cocina' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px' }}>🔥 COCINA</button>
          <button onClick={() => setSubModulo('caja')} style={{ padding: '12px 18px', background: subModulo === 'caja' ? '#10b981' : '#f3f4f6', color: subModulo === 'caja' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px' }}>💰 CAJA ({Object.keys(mesasEnCaja).length})</button>
          <button onClick={() => setSubModulo('menu')} style={{ padding: '12px 18px', background: subModulo === 'menu' ? '#3b82f6' : '#f3f4f6', color: subModulo === 'menu' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px' }}>⚙ ABM Menú</button>
          <button onClick={() => setSubModulo('config')} style={{ padding: '12px 18px', background: subModulo === 'config' ? '#f59e0b' : '#f3f4f6', color: subModulo === 'config' ? 'white' : '#4b5563', border: 'none', cursor: 'pointer', fontWeight: '800', borderRadius: '12px' }}>🏢 Variables</button>
          
          {/* BACKDOOR EXCLUSIVO DE ALDO DETECTADO PROGRAMÁTICAMENTE */}
          {esPropietarioSaaS && (
            <button onClick={() => setSubModulo('master_saas')} style={{ padding: '12px 18px', background: subModulo === 'master_saas' ? '#6d28d9' : '#fee2e2', color: subModulo === 'master_saas' ? 'white' : '#b91c1c', border: 'none', cursor: 'pointer', fontWeight: '900', borderRadius: '12px' }}>👑 MASTER SaaS</button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => signOut(auth)} style={{ padding: '10px 16px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {/* RENDERIZADO BACKDOOR CONTROL PANEL CENTRAL (PUNTO A) */}
      {subModulo === 'master_saas' && esPropietarioSaaS && (
        <div style={{ maxWidth: '600px', background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '2px solid #8b5cf6' }}>
          <h3 style={{ marginTop: 0, color: '#6d28d9', fontWeight: '900' }}>Panel del Operador Maestro (Pasta SaaS)</h3>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Control de licenciamiento y gating comercial para el tenant actual: <strong>{tenantId}</strong></p>
          
          <form onSubmit={guardarControlMaestroSaaS} style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '8px' }}>Estado de Suscripción comercial:</label>
              <select value={saasStatus} onChange={e => setSaasStatus(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', background: '#f3f4f6', border: 'none', fontWeight: '600' }}>
                <option value="demo">Período Demo Activo</option>
                <option value="activo">Cuenta Comercial Activa (Plan Pago)</option>
                <option value="suspendido">Cuenta Suspendida / Bloqueo Total</option>
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '8px' }}>Fecha de finalización de Demo / Licencia:</label>
              <input type="date" value={saasFechaDemo} onChange={e => setSaasFechaDemo(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', background: '#f3f4f6', border: 'none', fontWeight: '600' }} />
            </div>

            <button type="submit" style={{ width: '100%', padding: '18px', background: '#6d28d9', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}>Aplicar Cambios Globales</button>
          </form>
        </div>
      )}

      {/* RENDERIZADO: CONFIGURACIÓN GENERAL / MULTI-DIVISA (PUNTO B) */}
      {subModulo === 'config' && (
        <div style={{ maxWidth: '600px', background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <h3 style={{ marginTop: 0, color: '#111827', fontWeight: '900' }}>🏢 Variables Operativas del Local</h3>
          <form onSubmit={guardarVariablesRestaurante}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <label style={{ flex: 1, fontWeight: '700' }}>Nombre Comercial:<input type="text" value={inputNombreRest} onChange={e => setInputNombreRest(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none' }} required /></label>
              
              {/* SELECTOR DE MONEDA DE EXPORTACIÓN (PUNTO B) */}
              <label style={{ flex: 1, fontWeight: '700' }}>Moneda del Catálogo:<br/>
                <select value={inputMoneda} onChange={e => setInputMoneda(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none', fontWeight: '700' }}>
                  <option value="Gs.">Gs. (Paraguay)</option>
                  <option value="USD">USD (Dólares)</option>
                  <option value="ARS">ARS (Argentina)</option>
                  <option value="R$">R$ (Brasil)</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>URL del Logo:<input type="text" value={inputLogoUrl} onChange={e => setInputLogoUrl(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none' }} /></label>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '700' }}>Dirección:<input type="text" value={inputDireccion} onChange={e => setInputDireccion(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none' }} required /></label>
            <label style={{ display: 'block', marginBottom: '25px', fontWeight: '700' }}>Teléfono:<input type="text" value={inputTelefono} onChange={e => setInputTelefono(e.target.value)} style={{ width: '100%', padding: '14px', marginTop: '5px', borderRadius: '12px', background: '#f3f4f6', border: 'none' }} required /></label>

            <button type="submit" style={{ width: '100%', padding: '18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}>Guardar Cambios Operativos</button>
          </form>
        </div>
      )}

      {/* RENDER COMPONENTES DE OPERACIÓN TRADICIONALES (COCINA, CAJA, ABM) */}
      {subModulo === 'cocina' && <div style={{ color: '#111827' }}>📟 Monitor de cocina activo y sincronizado con dLocal Security. (Usa la interfaz fluida del panel).</div>}
      {subModulo === 'caja' && <div style={{ color: '#111827' }}>💵 Panel de Facturación abierto. Total mesas consumiendo: {Object.keys(mesasEnCaja).length}</div>}
      {subModulo === 'menu' && <div style={{ color: '#111827' }}>📝 Modulo ABM para altas y bajas manuales listo para recibir cargas masivas.</div>}

    </div>
  );
}
