(function () {
  'use strict';

  const D = window.MAPY;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Categorias que crea la automatizacion (Relojes > Citizen > coleccion). En la
     tienda es el mismo caso que Oris, asi que se montan sobre la plantilla de una
     coleccion de Oris: miga, arbol con las hermanas y la actual marcada. */
  const A = window.MAPY_AUTO;
  const NUEVAS = (A && A.categorias) || [];
  const nombreDe = r => (NUEVAS.find(d => d.ruta === r) || D.categorias[r] || {}).nombre || '';
  const hijasDe = r => NUEVAS.filter(d => d.padre === r);
  const itemArbol = (d, i, todos, actual) =>
    '<li' + (i === todos.length - 1 ? ' class="last"' : '') + '> <a href="#' + d.ruta + '"' +
    (d.ruta === actual ? ' class="selected"' : '') + '> ' + esc(d.nombre) + ' </a></li>';

  function crearCategoria(def, molde) {
    const t = document.createElement('template');
    t.innerHTML = molde.columnas;
    const f = t.content;
    const ancestros = def.ruta.split('/').filter(Boolean).slice(1, -1)
      .map((_, i, partes) => '/es/' + partes.slice(0, i + 1).join('/') + '/');
    const miga = $('.breadcrumb', f);
    if (miga) miga.innerHTML = ' <a class="home" href="#/" title="Volver a Inicio">INICIO</a> ' +
      ancestros.map(r => '<span class="navigation-pipe">&gt;</span> <a href="#' + r + '" title="' +
        esc(nombreDe(r)) + '" data-gg="">' + esc(nombreDe(r)) + '</a>').join('') +
      '<span class="navigation-pipe">&gt;</span>' + esc(def.nombre);
    // con hijas se listan ellas (Citizen); si no, las hermanas con la actual marcada
    const lista = hijasDe(def.ruta).length ? hijasDe(def.ruta) : hijasDe(def.padre);
    const arbol = $('#categories_block_left ul.tree', f);
    if (arbol) arbol.innerHTML = lista.map((d, i, todos) => itemArbol(d, i, todos, def.ruta)).join('');
    $$('.category-name, .cat-name', f).forEach(e => { e.textContent = ' ' + def.nombre + ' '; });
    // la tienda no ensena la descripcion (display:none); se deja una corta y correcta
    const marca = def.padre === '/es/relojes/' ? '' : nombreDe(def.padre) + ' ';
    $$('#category_description_short, #category_description_full', f).forEach(e => {
      e.innerHTML = '<p>Relojes ' + esc(marca + def.nombre) + '.</p>';
    });
    $$('.lnk_more', f).forEach(a => a.setAttribute('href', '#' + def.ruta));
    $$('input[name="producto"]', f).forEach(i => { i.value = def.nombre + ' - Joyeria Mapy'; });
    const clave = def.ruta.split('/').filter(Boolean).slice(-1)[0];
    return {
      nombre: def.nombre, css: molde.css, productos: [], subcategorias: {},
      body_class: 'category category-' + clave + ' hide-right-column lang_es',
      columnas: t.innerHTML,
    };
  }

  const molde = D.categorias['/es/relojes/oris/oris-aquis/'];
  if (molde) NUEVAS.forEach(def => { if (!D.categorias[def.ruta]) D.categorias[def.ruta] = crearCategoria(def, molde); });

  /* Los productos que sube la automatizacion llegan en auto.js, que se reescribe
     cada noche. No van amontonados arriba: se reparten a partes iguales por todo
     el listado, entre los de la tienda, del mas reciente al mas viejo. Cada
     tarjeta automatica lleva juntos sus acabados (mismo "base"). */
  if (A && A.productos && A.productos.length) {
    const ids = new Set(A.productos.map(p => p.id));
    D.productos = A.productos.concat(D.productos.filter(p => !p.auto));
    const porCategoria = {};
    A.productos.forEach(p => (p.cats || [p.categoria]).forEach(r => {
      (porCategoria[r] = porCategoria[r] || []).push(p);
    }));
    Object.entries(porCategoria).forEach(([ruta, lista]) => {
      const c = D.categorias[ruta];
      if (!c) return;
      const grupos = new Map();
      lista.slice().sort((a, b) => (b.f || '').localeCompare(a.f || '')).forEach(p => {
        const k = p.base || p.id;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(p.id);
      });
      const tarjetas = Array.from(grupos.values());
      const tienda = c.productos.filter(id => !ids.has(id));
      const total = tienda.length + tarjetas.length, paso = total / tarjetas.length;
      const mezcla = [];
      for (let k = 0, s = 0, g = 0; k < total; k++) {
        const toca = g < tarjetas.length && (s >= tienda.length || k >= Math.floor(g * paso + paso / 2));
        if (toca) mezcla.push(...tarjetas[g++]); else mezcla.push(tienda[s++]);
      }
      c.productos = mezcla;
    });
    A.productos.forEach(p => { if (p.genero) (D.genero[p.genero] = D.genero[p.genero] || []).push(p.id); });
  }
  const PROD = new Map(D.productos.map(p => [p.id, p]));
  const RUTA = new Map(D.productos.map(p => [p.ruta, p]));
  const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

  /* Las fotos viajan en paquetes fotos/<tipo><n>.js (el visor admite pocos ficheros).
     tipo "l" = listado 372x580, "g" = ficha y galeria. */
  const PAQUETES = {}, AVISADOS = {};
  window.MAPY_FOTOS = (tipo, n, datos) => {
    const clave = tipo + n;
    if (AVISADOS[clave]) AVISADOS[clave](datos);
  };
  function paquete(tipo, n) {
    const clave = tipo + n;
    if (!PAQUETES[clave]) {
      PAQUETES[clave] = new Promise((resolver, fallar) => {
        AVISADOS[clave] = resolver;
        const s = document.createElement('script');
        s.src = 'fotos/' + clave + '.js';
        s.onerror = () => { delete PAQUETES[clave]; fallar(new Error('sin paquete ' + clave)); };
        document.head.appendChild(s);
      });
    }
    return PAQUETES[clave];
  }
  function urlFoto(id, tipo) {
    // fotos de la automatizacion: ficheros sueltos en img/auto, sin paquete
    if (id && id.startsWith('auto/')) return Promise.resolve('img/' + id + (tipo === 'l' ? '-l' : '') + '.avif');
    const n = id && D.paquetes[tipo] ? D.paquetes[tipo][id] : undefined;
    if (n === undefined) return Promise.resolve(PIXEL);
    return paquete(tipo, n).then(d => d[id] ? 'data:image/avif;base64,' + d[id] : PIXEL, () => PIXEL);
  }
  const FOTO = (id, tipo) => 'src="' + PIXEL + '" data-foto="' + (id || '') + '" data-tipo="' + tipo + '"';
  // carga las fotos de los <img data-foto> cuando se acercan a la pantalla
  const vigia = 'IntersectionObserver' in window ? new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) { vigia.unobserve(e.target); cargarFoto(e.target); } });
  }, { rootMargin: '600px 0px' }) : null;
  function cargarFoto(img) {
    const id = img.dataset.foto, tipo = img.dataset.tipo;
    urlFoto(id, tipo).then(u => { if (img.dataset.foto === id) img.src = u; });
  }
  function hidratar(raiz) {
    (raiz || document).querySelectorAll('img[data-foto]').forEach(img => {
      if (img.dataset.hidratada === img.dataset.foto) return;
      img.dataset.hidratada = img.dataset.foto;
      if (vigia && img.closest('.product_list')) vigia.observe(img); else cargarFoto(img);
    });
  }
  const miles = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const eur = v => miles(v) + ' €';
  const POR_PAGINA = 96;
  const GRUPO = new Map();
  D.productos.forEach(p => {
    if (!p.base) return;
    if (!GRUPO.has(p.base)) GRUPO.set(p.base, []);
    GRUPO.get(p.base).push(p);
  });
  const agrupar = lista => {
    const vistos = new Set();
    return lista.filter(p => {
      if (!p.base) return true;
      if (vistos.has(p.base)) return false;
      vistos.add(p.base);
      return true;
    });
  };
  const truncar = (s, largo = 45) => {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= largo) return s;
    return s.slice(0, largo - 2).replace(/\s+?(\S+)?$/, '') + '...';
  };
  const ETIQUETA_AUTO = 'Producto subido automáticamente';

  const columnas = $('#columns');
  const cuerpo = document.body;

  /* ------------------------------------------------------------------ rutas */

  function leerRuta() {
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || '/es/';
    const [ruta, qs] = h.split('?');
    const q = {};
    (qs || '').split('&').filter(Boolean).forEach(par => {
      const [k, v] = par.split('=');
      q[k] = decodeURIComponent((v || '').replace(/\+/g, ' '));
    });
    return { ruta: ALIAS[ruta] || ruta, q };
  }

  // enlaces antiguos que la tienda sigue usando en el menu y en el inicio
  const ALIAS = { '/': '/es/', '/13-relojes': '/es/relojes/', '/es/12-joyas-lanzarote-canarias': '/es/joyas/',
    '/es/relojes': '/es/relojes/', '/es/outlet': '/es/outlet/' };

  function ir(ruta, q) {
    const qs = Object.entries(q || {}).filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    location.hash = ruta + (qs ? '?' + qs : '');
  }

  function pintar() {
    const { ruta, q } = leerRuta();
    cerrarCapas();
    if (ruta === '/es/' || ruta === '/') return inicio();
    if (ruta.startsWith('/es/buscar')) return busqueda(q.search_query || '', q);
    if (RUTA.has(ruta)) return ficha(RUTA.get(ruta));
    if (D.categorias[ruta]) return categoria(ruta, q);
    if (D.paginas[ruta]) return pagina(ruta);
    return noIncluida(ruta);
  }

  function preparar(id, clase, html, css) {
    $$('style[id^="css-"]').forEach(s => { s.media = s.id === 'css-' + (css || D.inicio.css) ? 'all' : 'not all'; });
    cuerpo.id = id;
    cuerpo.className = clase;
    columnas.innerHTML = html;
    // bloques del pie que la tienda solo pinta en las fichas
    $$('#viewed-products_block_left, #footer .skillshop').forEach(b => { b.style.display = id === 'product' ? '' : 'none'; });
    window.scrollTo(0, 0);
  }

  /* --------------------------------------------------------- listados */

  function tarjeta(p, i, total) {
    const clases = ['ajax_block_product', 'col-xs-6', 'col-sm-6', 'col-md-3'];
    if (i % 4 === 0) clases.push('first-in-line');
    if (i % 4 === 3) clases.push('last-in-line');
    if (i % 2 === 0) clases.push('first-item-of-tablet-line', 'first-item-of-mobile-line');
    if (i % 2 === 1) clases.push('last-item-of-tablet-line', 'last-item-of-mobile-line');
    if (i >= total - (total % 4 || 4)) clases.push('last-line');
    const titulo = esc(p.n);
    const href = '#' + p.ruta;
    const precio = '<span itemprop="price" class="price product-price"> ' + esc(p.pt) + ' </span>' +
      (p.vt ? ' <span class="old-price product-price"> ' + esc(p.vt) + ' </span>' : '') +
      (p.rt ? ' <span class="price-percent-reduction">' + esc(p.rt) + '</span>' : '') +
      '<meta itemprop="priceCurrency" content="0">';
    const grupo = p.base ? GRUPO.get(p.base) : null;
    const acabados = grupo && grupo.length > 1
      ? '<div class="mapy-acabados" role="group" aria-label="Acabados">' + grupo.map(v =>
          '<button type="button" class="mapy-acabado" data-id="' + v.id + '" aria-pressed="' + (v.id === p.id) +
          '" aria-label="Acabado ' + esc(v.r) + '">' + esc(v.v) + '</button>').join('') +
        '<span>' + grupo.length + ' acabados</span></div>'
      : '';
    return '<li class="' + clases.join(' ') + '" id="' + esc(p.m) + '" data-id="' + p.id + '">' +
      '<div class="product-container offer-' + esc(p.m) + '" itemscope itemtype="http://schema.org/Product">' +
      '<div class="left-block"><div class="product-image-container">' +
      (p.auto ? '<span class="mapy-auto">' + ETIQUETA_AUTO + '</span>' : '') +
      ' <a class="product_img_link" href="' + href + '" title="' + titulo + '" itemprop="url"> ' +
      '<img class="replace-2x img-responsive lazy hidden-xs" ' + FOTO(p.il, 'l') + ' alt="' + titulo +
      '" title="' + titulo + '" loading="lazy" decoding="async" width="186" height="290" itemprop="image">' +
      '<img class="replace-2x img-responsive lazy visible-xs" ' + FOTO(p.il, 'l') + ' alt="' + titulo +
      '" title="' + titulo + '" loading="lazy" decoding="async" width="186" height="290" itemprop="image"></a>' +
      '<div class="content_price" itemprop="offers" itemscope itemtype="http://schema.org/Offer"> ' + precio +
      '</div></div></div>' +
      '<div class="right-block">' + (p.m ? '<span class="marca">' + esc(p.m) + '</span> ' : '') +
      '<span class="nombre" itemprop="name"> <a class="" href="' + href + '" title="' + titulo +
      '" itemprop="url"> ' + esc(grupo && grupo.length > 1 ? truncar(p.titulo) : p.c) + ' </a> </span>' + acabados +
      '<div itemprop="offers" itemscope itemtype="http://schema.org/Offer" class="content_price"> ' + precio +
      '</div></div></div></li>';
  }

  function ordenar(lista, orden) {
    const [campo, sentido] = (orden || 'date_upd:desc').split(':');
    if (campo === 'date_upd') return lista;
    const s = sentido === 'desc' ? -1 : 1;
    const copia = lista.slice();
    if (campo === 'price') copia.sort((a, b) => ((a.p || 0) - (b.p || 0)) * s);
    if (campo === 'name') copia.sort((a, b) => a.n.localeCompare(b.n, 'es') * s);
    return copia;
  }

  function paginacion(total, pag, n, sufijo) {
    const paginas = Math.max(1, Math.ceil(total / n));
    const enlace = k => '<li><a href="#" data-pag="' + k + '"> <span>' + k + '</span> </a></li>';
    let h = '';
    h += pag > 1
      ? '<li id="pagination_previous' + sufijo + '" class="pagination_previous"> <a href="#" data-pag="' +
        (pag - 1) + '"> <i class="icon-chevron-left"></i> <b></b> </a></li>'
      : '<li id="pagination_previous' + sufijo + '" class="disabled pagination_previous"> <span> ' +
        '<i class="icon-chevron-left"></i> <b></b> </span></li>';
    const ini = Math.max(1, pag - 2), fin = Math.min(paginas, pag + 2);
    if (ini === 3) h += enlace(1) + enlace(2);
    if (ini === 2) h += enlace(1);
    if (ini > 3) h += enlace(1) + '<li class="truncate"> <span> <span>...</span> </span></li>';
    for (let k = ini; k <= fin; k++) {
      h += k === pag ? '<li class="active current"> <span> <span>' + k + '</span> </span></li>' : enlace(k);
    }
    if (paginas > fin + 2) h += '<li class="truncate"> <span> <span>...</span> </span></li>' + enlace(paginas);
    if (paginas === fin + 1) h += enlace(paginas);
    if (paginas === fin + 2) h += enlace(paginas - 1) + enlace(paginas);
    h += pag < paginas
      ? '<li id="pagination_next' + sufijo + '" class="pagination_next"> <a href="#" data-pag="' + (pag + 1) +
        '"> <b></b> <i class="icon-chevron-right"></i> </a></li>'
      : '<li id="pagination_next' + sufijo + '" class="disabled pagination_next"> <span> <b></b> ' +
        '<i class="icon-chevron-right"></i> </span></li>';
    return { html: h, paginas };
  }

  /* Rellena un bloque de listado ya pintado (categoria, busqueda, inicio). */
  function rellenarListado(raiz, productos, q, alCambiar) {
    const n = q.n === 'all' ? Math.max(productos.length, 1) : POR_PAGINA;
    const orden = q.orderby ? q.orderby + ':' + (q.orderway || 'asc') : 'date_upd:desc';
    const lista = ordenar(agrupar(productos), orden);
    let pag = Math.max(1, parseInt(q.p || '1', 10));
    const pg = paginacion(lista.length, pag, n, '');
    if (pag > pg.paginas) pag = 1;
    const trozo = lista.slice((pag - 1) * n, pag * n);

    const ul = $('ul.product_list', raiz);
    if (ul) { ul.innerHTML = trozo.map((p, i) => tarjeta(p, i, trozo.length)).join(''); hidratar(ul); }

    $$('ul.pagination', raiz).forEach((u, k) => {
      u.innerHTML = paginacion(lista.length, pag, n, k ? '_bottom' : '').html;
    });
    $$('form.showall', raiz).forEach(f => {
      f.style.display = lista.length > n && pg.paginas > 1 ? '' : 'none';
      f.onsubmit = e => { e.preventDefault(); alCambiar({ n: 'all', p: '' }); };
    });
    $$('.totalpro', raiz).forEach(t => { t.textContent = lista.length + ' Productos'; });
    $$('.heading-counter', raiz).forEach(t => {
      t.textContent = lista.length === 1 ? 'Hay 1 producto.' : 'Hay ' + lista.length + ' productos.';
    });
    $$('select.selectProductSort', raiz).forEach(s => {
      s.value = orden;
      s.onchange = () => {
        const [campo, sentido] = s.value.split(':');
        alCambiar(campo === 'date_upd' ? { orderby: '', orderway: '', p: '' }
          : { orderby: campo, orderway: sentido, p: '' });
      };
    });
    $$('ul.pagination a[data-pag]', raiz).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      alCambiar({ p: a.dataset.pag });
    }));
  }

  /* --------------------------------------------------------- categoria */

  function categoria(ruta, q) {
    const c = D.categorias[ruta];
    preparar('category', c.body_class, c.columnas, c.css);
    const base = c.productos.map(id => PROD.get(id)).filter(Boolean);
    const estado = filtrosDesdeQuery(q);
    const cambiar = extra => ir(ruta, Object.assign({}, q, extra));

    const aplicar = () => {
      const lista = base.filter(p => cumpleFiltros(p, estado, c));
      rellenarListado(columnas, lista, q, cambiar);
    };
    montarFiltros(c, base, estado, nuevo => {
      ir(ruta, Object.assign({}, q, filtrosAQuery(nuevo), { p: '' }));
    });
    montarArbol(ruta);
    aplicar();
    if (q.p) window.scrollTo(0, 0);
  }

  function filtrosDesdeQuery(q) {
    return {
      cat: (q.cat || '').split(',').filter(Boolean),
      gen: (q.gen || '').split(',').filter(Boolean),
      pmin: q.pmin ? +q.pmin : null,
      pmax: q.pmax ? +q.pmax : null,
    };
  }

  function filtrosAQuery(e) {
    return { cat: e.cat.join(','), gen: e.gen.join(','), pmin: e.pmin ?? '', pmax: e.pmax ?? '' };
  }

  function cumpleFiltros(p, e, c) {
    if (e.cat.length && !e.cat.some(k => (D.categorias[k] || { productos: [] }).set.has(p.id))) return false;
    if (e.gen.length && !e.gen.some(g => (D.genero[g] || new Set()).has(p.id))) return false;
    if (e.pmin != null && (p.p || 0) < e.pmin) return false;
    if (e.pmax != null && (p.p || 0) > e.pmax) return false;
    return true;
  }

  function montarFiltros(c, base, estado, alCambiar) {
    const bloque = $('#layered_block_left', columnas);
    if (!bloque) return;
    const activos = [];

    $$('input.checkbox[type="checkbox"]', bloque).forEach(inp => {
      const nombre = inp.name || '';
      const etiqueta = (inp.closest('li') ? inp.closest('li').textContent : '').trim();
      let clave = null, lista = null;
      if (nombre.startsWith('layered_category_')) {
        clave = c.subcategorias[inp.value] || null;
        lista = estado.cat;
      } else if (nombre.startsWith('layered_id_feature_')) {
        clave = inp.value.split('_')[0];
        lista = estado.gen;
      }
      if (!clave) return;
      const marcado = lista.includes(clave);
      inp.checked = marcado;
      const span = inp.parentElement && inp.parentElement.tagName === 'SPAN' ? inp.parentElement : null;
      if (span) span.className = marcado ? 'checked' : '';
      if (marcado) {
        const titulo = inp.closest('.layered_filter') ? $('.layered_subtitle', inp.closest('.layered_filter')) : null;
        activos.push({ texto: (titulo ? titulo.textContent.trim() + ': ' : '') + etiqueta, quitar: () => {
          lista.splice(lista.indexOf(clave), 1); alCambiar(estado);
        } });
      }
      const alternar = e => {
        e.preventDefault();
        const i = lista.indexOf(clave);
        if (i >= 0) lista.splice(i, 1); else lista.push(clave);
        alCambiar(estado);
      };
      inp.addEventListener('change', alternar);
      const a = inp.closest('li') && $('label a', inp.closest('li'));
      if (a) a.addEventListener('click', alternar);
    });

    const precio = $('.layered_price', bloque);
    if (precio && base.length) {
      // las piezas sin precio (Facet, hasta tener su tarifa) no cuentan para el rango
      const precios = base.filter(p => p.p != null).map(p => p.p);
      if (!precios.length) precios.push(0);
      const min = Math.floor(Math.min(...precios)), max = Math.ceil(Math.max(...precios));
      const lo = estado.pmin ?? min, hi = estado.pmax ?? max;
      precio.style.display = '';
      const rango = $('#layered_price_range', precio);
      const pintarRango = (a, b) => { if (rango) rango.textContent = miles(a) + '€ - ' + miles(b) + '€'; };
      pintarRango(lo, hi);
      const slider = $('#layered_price_slider', precio);
      if (slider) montarSlider(slider, min, max, lo, hi, pintarRango, (a, b) => {
        estado.pmin = a > min ? a : null;
        estado.pmax = b < max ? b : null;
        alCambiar(estado);
      });
      if (estado.pmin != null || estado.pmax != null) {
        activos.push({ texto: 'Precio: ' + miles(lo) + '€ - ' + miles(hi) + '€', quitar: () => {
          estado.pmin = estado.pmax = null; alCambiar(estado);
        } });
      }
    }

    const ul = $('#enabled_filters ul', bloque);
    if (ul) {
      ul.innerHTML = activos.map((f, i) =>
        '<li><a href="#" data-quitar="' + i + '" title="Cancelar"><i class="icon-remove"></i></a> ' +
        esc(f.texto) + '</li>').join('');
      $$('a[data-quitar]', ul).forEach(a => a.addEventListener('click', e => {
        e.preventDefault(); activos[+a.dataset.quitar].quitar();
      }));
    }
  }

  function montarSlider(el, min, max, lo, hi, alMover, alSoltar) {
    el.className = 'layered_slider ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all';
    el.innerHTML = '<div class="ui-slider-range ui-widget-header ui-corner-all"></div>' +
      '<a class="ui-slider-handle ui-state-default ui-corner-all" href="#"></a>' +
      '<a class="ui-slider-handle ui-state-default ui-corner-all" href="#"></a>';
    const [rango, h1, h2] = el.children;
    const pct = v => max === min ? 0 : (v - min) / (max - min) * 100;
    const val = { lo, hi };
    const colocar = () => {
      h1.style.left = pct(val.lo) + '%';
      h2.style.left = pct(val.hi) + '%';
      rango.style.left = pct(val.lo) + '%';
      rango.style.width = (pct(val.hi) - pct(val.lo)) + '%';
    };
    colocar();
    [h1, h2].forEach((h, k) => {
      h.addEventListener('click', e => e.preventDefault());
      h.addEventListener('pointerdown', e => {
        e.preventDefault();
        h.setPointerCapture(e.pointerId);
        const caja = el.getBoundingClientRect();
        const mover = ev => {
          const x = Math.min(1, Math.max(0, (ev.clientX - caja.left) / caja.width));
          const v = Math.round(min + x * (max - min));
          if (k === 0) val.lo = Math.min(v, val.hi); else val.hi = Math.max(v, val.lo);
          colocar();
          alMover(val.lo, val.hi);
        };
        const soltar = () => {
          h.removeEventListener('pointermove', mover);
          h.removeEventListener('pointerup', soltar);
          alSoltar(val.lo, val.hi);
        };
        h.addEventListener('pointermove', mover);
        h.addEventListener('pointerup', soltar);
      });
    });
  }

  /* El arbol de categorias de la columna izquierda. La tienda lo ensena en
     escritorio en todas las categorias menos estas tres (comprobado una a una el
     19/09). En movil lo esconde y su boton "VER POR CATEGORIA" no hace nada: en
     el clon ese boton lo abre y lo cierra. */
  const ARBOL_OCULTO = new Set(['/es/joyas/', '/es/joyas/solitarios-alianzas/', '/es/outlet/']);
  const MOVIL = window.matchMedia('(max-width: 767px)');

  const esHijaDe = (a, padre) => {
    const h = (a && a.getAttribute('href') || '').slice(1);
    return h.startsWith(padre) && h.slice(padre.length).split('/').filter(Boolean).length === 1;
  };
  const compara = (x, y) => x.localeCompare(y, 'es', { sensitivity: 'base' });

  /* Una marca nueva entra en los arboles de la tienda donde salen sus hermanas.
     En Relojes las marcas van de la A a la Z detras de ORIS, y ahi entra por orden
     alfabetico. En Joyas el orden es a mano, y va al final, que es donde
     PrestaShop pone una categoria nueva. */
  function anadirAlArbol(def) {
    $$('#categories_block_left ul', columnas).forEach(ul => {
      const items = Array.from(ul.children).filter(li => li.tagName === 'LI');
      const enlaces = items.map(li => $(':scope > a', li));
      if (!items.length || !enlaces.every(a => esHijaDe(a, def.padre))) return;
      if (enlaces.some(a => a.getAttribute('href') === '#' + def.ruta)) return;
      const hijas = hijasDe(def.ruta);
      const li = document.createElement('li');
      li.innerHTML = (hijas.length ? ' <span class="grower CLOSE"> </span>' : ' ') +
        '<a href="#' + def.ruta + '"> ' + esc(def.nombre) + ' </a>' +
        (hijas.length ? '<ul style="display: none;">' + hijas.map((d, i, t) => itemArbol(d, i, t, '')).join('') + '</ul>' : '');
      const nombres = enlaces.slice(1).map(a => a.textContent.trim());
      const alfabetico = nombres.every((n, i) => i === 0 || compara(nombres[i - 1], n) <= 0);
      const antes = alfabetico && items.find((x, i) => i > 0 && compara(enlaces[i].textContent.trim(), def.nombre) > 0);
      if (antes) ul.insertBefore(li, antes);
      else {
        items[items.length - 1].classList.remove('last');
        li.className = 'last';
        ul.appendChild(li);
      }
    });
  }

  function montarArbol(ruta) {
    NUEVAS.filter(d => !NUEVAS.some(x => x.ruta === d.padre)).forEach(anadirAlArbol);
    // la tienda pone en negrita el primero de cada lista. En una marca es su
    // titulo ("NOVEDADES ORIS") y se queda; en la lista de marcas de Relojes,
    // ORIS es una marca mas y va como las otras
    $$('#categories_block_left ul', columnas).forEach(ul => {
      const primero = ul.firstElementChild;
      if (primero && esHijaDe($(':scope > a', primero), '/es/relojes/')) primero.classList.add('mapy-como-las-demas');
    });
    const arbol = $('#categories_block_left .block_content', columnas);
    if (arbol) arbol.style.display = MOVIL.matches || ARBOL_OCULTO.has(ruta) ? 'none' : '';
    const boton = $('#title-block', columnas);
    if (boton && arbol) boton.addEventListener('click', e => {
      e.preventDefault();
      const abrir = arbol.style.display === 'none';
      arbol.style.display = abrir ? '' : 'none';
      // en movil la columna izquierda queda bajo la cabecera fija: se abre bajo el boton
      const fila = boton.closest('.content_sortPagiBar');
      if (abrir && fila) fila.after($('#categories_block_left', columnas));
    });
    $$('#categories_block_left span.grower', columnas).forEach(g => g.addEventListener('click', () => {
      const abierto = g.classList.contains('OPEN');
      g.classList.toggle('OPEN', !abierto);
      g.classList.toggle('CLOSE', abierto);
      const hijo = g.parentElement.querySelector(':scope > ul');
      if (hijo) hijo.style.display = abierto ? 'none' : 'block';
    }));
  }

  /* ----------------------------------------------------------- inicio */

  function inicio() {
    preparar('index', D.inicio.body_class, D.inicio.columnas, D.inicio.css);
    const lista = D.destacados.map(id => PROD.get(id)).filter(Boolean);
    const ul = $('ul.product_list', columnas);
    if (ul) { ul.innerHTML = lista.map((p, i) => tarjeta(p, i, lista.length)).join(''); hidratar(ul); }
  }

  /* --------------------------------------------------------- busqueda */

  const quitarTildes = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function busqueda(texto, q) {
    const t = D.buscar;
    preparar('search', t.body_class, t.columnas, t.css);
    const palabras = quitarTildes(texto).split(/\s+/).filter(w => w.length > 1);
    const lista = palabras.length ? D.productos.filter(p => {
      const campo = quitarTildes([p.n, p.r, p.m].join(' '));
      return palabras.every(w => campo.includes(w));
    }) : [];
    $$('.lighter', columnas).forEach(s => { s.textContent = ' "' + texto + '" '; });
    $$('#search_query_top').forEach(i => { i.value = texto; });
    rellenarListado(columnas, lista, q, extra => ir('/es/buscar', Object.assign({}, q, extra)));
    $$('.heading-counter', columnas).forEach(t => {
      t.textContent = lista.length === 1 ? ' 1 result has been found. ' : ' ' + lista.length + ' results have been found. ';
    });
    if (!lista.length) {
      const centro = $('#center_column', columnas);
      $$('.content_sortPagiBar, .top-pagination-content, ul.product_list', centro).forEach(x => x.remove());
      centro.insertAdjacentHTML('beforeend', '<p class="alert alert-warning"> No results were found for your search&nbsp;"' +
        esc(texto) + '"</p>');
    }
  }

  /* ------------------------------------------------------------ ficha */

  function ficha(p) {
    const t = D.producto;
    preparar('product', 'product product-' + p.id + ' ' + (p.clase || 'category-13 category-relojes') +
      ' hide-left-column hide-right-column lang_es', t.columnas, t.css);
    recordarVisto(p.id);

    const miga = $('.breadcrumb', columnas);
    if (miga) miga.innerHTML = p.mig;

    const principal = p.ip || p.im[0];
    $$('#image-block img', columnas).forEach(img => {
      img.dataset.foto = principal || ''; img.dataset.tipo = 'g';
      img.alt = img.title = p.n;
      img.removeAttribute('srcset');
    });
    montarZoom();

    const lista = $('#thumbs_list_frame', columnas);
    const vistas = $('#views_block', columnas);
    if (lista) {
      lista.innerHTML = p.im.map((id, k) =>
        '<li id="thumbnail_' + id + '"' + (k === p.im.length - 1 ? ' class="last"' : '') + '> ' +
        '<a href="#" data-img="' + id + '" class="fancybox' + (id === principal ? ' shown' : '') +
        '" title="' + esc(p.n) + '"> <img class="img-responsive" id="thumb_' + id + '" ' + FOTO(id, 'g') +
        ' alt="' + esc(p.n) + '" title="' + esc(p.n) + '" height="80" width="80" itemprop="image"> </a></li>'
      ).join('');
      if (vistas) vistas.classList.toggle('hidden', p.im.length < 2);
      $$('a[data-img]', lista).forEach(a => {
        const cambiar = e => {
          e.preventDefault();
          $$('#image-block img', columnas).forEach(img => { img.dataset.foto = a.dataset.img; img.dataset.tipo = 'g'; });
          hidratar(columnas);
          $$('a.shown', lista).forEach(x => x.classList.remove('shown'));
          a.classList.add('shown');
        };
        a.addEventListener('mouseover', cambiar);
        a.addEventListener('click', cambiar);
      });
      montarCarrusel();
    }

    const h1 = $('h1[itemprop="name"]', columnas);
    if (h1) {
      h1.textContent = p.n;
      if (p.auto) h1.insertAdjacentHTML('beforebegin',
        '<span class="mapy-auto mapy-auto--ficha">' + ETIQUETA_AUTO + '</span>');
    }
    $$('#product_reference span, .pb-center-column p > span.editable[itemprop="sku"]', columnas)
      .forEach(s => { s.textContent = p.r; s.setAttribute('content', p.r); });
    const refBloque = $('#product_reference', columnas);
    if (refBloque) refBloque.style.display = p.r || p.cb.length ? '' : 'none';
    if (refBloque && p.ean) {
      // la plantilla repite la referencia en un segundo parrafo, y es ese el que se ve
      const sig = refBloque.nextElementSibling;
      const visible = sig && sig.querySelector('[itemprop="sku"]') ? sig : refBloque;
      visible.insertAdjacentHTML('afterend',
        '<span class="titpro">EAN13</span><p class="mapy-ean"><span class="editable">' +
        esc(p.ean) + '</span></p>');
    }

    const marca = $('.marcashow', columnas);
    // logo de la marca: los de la tienda y Citizen van en datos.js; el de un
    // proveedor nuevo lo deja la automatizacion en img/auto/
    const logo = p.ml && (D.logos[p.ml] || (p.ml.startsWith('img/') ? p.ml : ''));
    if (marca) {
      if (logo) {
        const img = $('img', marca);
        if (img) img.src = logo;
        marca.style.display = '';
      } else {
        marca.style.display = 'none';
      }
    }

    // DETALLES: se sustituye todo lo que hay entre el rotulo y .extras
    const rotulo = $$('.pb-center-column span.titpro', columnas).find(s => s.textContent.trim() === 'DETALLES');
    if (rotulo) {
      let n = rotulo.nextSibling;
      while (n && !(n.nodeType === 1 && n.classList.contains('extras'))) {
        const sig = n.nextSibling; n.remove(); n = sig;
      }
      rotulo.insertAdjacentHTML('afterend', p.det);
    }
    const extras = $('.pb-center-column .extras', columnas);
    if (extras) extras.insertAdjacentHTML('beforebegin', acabados(p) + tecnica(p) + aval(p.m || 'Mapy'));

    const precio = $('#our_price_display', columnas);
    if (precio) precio.textContent = p.pt;
    // sin precio (Facet hasta tener su tarifa) PrestaShop no deja pedirlo: se
    // quitan el precio y COMPRAR, y queda "SOLICITAR MEJOR PRECIO"
    if (p.p == null) {
      $$('.content_prices .price, #add_to_cart', columnas).forEach(e => { e.style.display = 'none'; });
    }
    const viejo = $('#old_price_display', columnas);
    if (viejo) viejo.textContent = p.vt;
    const oldP = $('#old_price', columnas);
    if (oldP) oldP.style.display = p.vt ? '' : 'none';

    montarAtributos(p);

    $$('.formesp img', columnas).forEach(img => { img.dataset.foto = principal || ''; img.dataset.tipo = 'g'; img.alt = img.title = p.n; });
    hidratar(columnas);
    $$('.formesp small', columnas).forEach(s => { s.textContent = p.n; });
    $$('.formesp input[name="producto"]', columnas).forEach(i => { i.value = p.n; });

    montarVistos(p.id);
  }

  function montarAtributos(p) {
    const cont = $('.product_attributes', columnas);
    const previo = $('#attributes', columnas);
    if (previo) previo.remove();
    if (!cont || !p.g.length) return;
    const html = '<div id="attributes"><div class="clearfix"></div>' + p.g.map(g =>
      '<fieldset class="attribute_fieldset"> <label class="attribute_label" for="' + g.id + '">' + esc(g.e) +
      ' </label><div class="attribute_list"> <select name="' + g.id + '" id="' + g.id +
      '" class="form-control attribute_select no-print">' +
      g.o.map(o => '<option value="' + o[0] + '"' + (o[2] ? ' selected' : '') + ' title="' + esc(o[1]) + '">' +
        esc(o[1]) + '</option>').join('') + '</select></div></fieldset>').join('') + '</div>';
    cont.insertAdjacentHTML('beforeend', html);

    const iDiam = p.g.findIndex(g => /DIAMANTE/i.test(g.e) && g.o.every(o => !isNaN(parseFloat(o[1]))));
    const conDibujo = iDiam >= 0 && unaPiedra(p);
    const mayor = conDibujo ? Math.max(...p.g[iDiam].o.map(o => parseFloat(o[1]))) : 0;
    if (conDibujo) $('#attributes', columnas).insertAdjacentHTML('beforeend',
      '<figure class="mapy-diamante" id="mapy-diamante"></figure>');

    const actualizar = () => {
      const elegidos = $$('#attributes select', columnas).map(s => s.value);
      if (conDibujo) {
        const sel = $('#' + p.g[iDiam].id, columnas);
        $('#mapy-diamante', columnas).innerHTML =
          figuraDiamante(parseFloat(sel.options[sel.selectedIndex].text), mayor);
      }
      const combo = p.cb.find(c => elegidos.every(v => c[1].includes(v)));
      const precio = $('#our_price_display', columnas);
      if (combo) {
        if (precio) precio.textContent = D.formatoCombinacion((p.pb || 0) + combo[2]);
        if (combo[3]) $$('#product_reference span', columnas).forEach(s => { s.textContent = combo[3]; });
        const r = $('#product_reference', columnas);
        if (r) r.style.display = combo[3] ? '' : 'none';
      }
    };
    $$('#attributes select', columnas).forEach(s => s.addEventListener('change', actualizar));
    actualizar();
  }

  function montarZoom() {
    const caja = $('#image-block .zoom', columnas);
    if (!caja) return;
    const img = $('img', caja);
    let lupa = null;
    caja.style.position = 'relative';
    caja.style.overflow = 'hidden';
    caja.addEventListener('mouseenter', () => {
      lupa = document.createElement('img');
      lupa.className = 'zoomImg';
      lupa.src = img.src;
      lupa.alt = '';
      Object.assign(lupa.style, { position: 'absolute', top: 0, left: 0, opacity: 1, border: 'none',
        maxWidth: 'none', maxHeight: 'none', width: (img.clientWidth * 1.43) + 'px',
        height: (img.clientHeight * 1.43) + 'px', pointerEvents: 'none' });
      caja.appendChild(lupa);
    });
    caja.addEventListener('mousemove', e => {
      if (!lupa) return;
      const r = caja.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      lupa.style.left = -(lupa.clientWidth - r.width) * x + 'px';
      lupa.style.top = -(lupa.clientHeight - r.height) * y + 'px';
    });
    caja.addEventListener('mouseleave', () => { if (lupa) lupa.remove(); lupa = null; });
  }

  function montarCarrusel() {
    const marco = $('#thumbs_list', columnas), tira = $('#thumbs_list_frame', columnas);
    const izq = $('#view_scroll_left', columnas), der = $('#view_scroll_right', columnas);
    if (!marco || !tira) return;
    let desp = 0;
    const paso = () => (tira.firstElementChild ? tira.firstElementChild.getBoundingClientRect().width + 10 : 100);
    const mover = sentido => e => {
      e.preventDefault();
      const maximo = Math.max(0, tira.scrollWidth - marco.clientWidth);
      desp = Math.min(maximo, Math.max(0, desp + sentido * paso()));
      tira.style.transform = 'translateX(' + -desp + 'px)';
    };
    if (izq) izq.onclick = mover(-1);
    if (der) der.onclick = mover(1);
  }

  /* ------------------------------------------------- productos vistos */

  function leerVistos() {
    try { return JSON.parse(localStorage.getItem('mapy-vistos') || '[]'); } catch (e) { return []; }
  }

  function recordarVisto(id) {
    const v = leerVistos().filter(x => x !== id);
    v.unshift(id);
    try { localStorage.setItem('mapy-vistos', JSON.stringify(v.slice(0, 8))); } catch (e) { /* sin almacenamiento */ }
  }

  function montarVistos() {
    const lista = $('#viewed-products_block_left ul');
    if (!lista) return;
    const ids = leerVistos().filter(id => PROD.has(id) && PROD.get(id).ip);
    lista.innerHTML = ids.map((id, k) => {
      const p = PROD.get(id);
      return '<li class="clearfix' + (k === ids.length - 1 ? ' last_item' : '') + '"> ' +
        '<a class="products-block-image" href="#' + p.ruta + '" title="Más acerca de ' + esc(p.n) + '"> ' +
        '<img ' + FOTO(p.ip, 'g') + ' alt="' + esc(p.n) + '"> </a></li>';
    }).join('');
    hidratar(lista);
  }

  /* ------------------------------------------ mejoras sobre la tienda */
  /* Lo que trae la maqueta de Pedro, dentro de la ficha real de la tienda.
     No hay vista rapida: cada producto se abre en su propia pagina. */

  // diametro aproximado de un brillante redondo segun su peso: 1 ct ~ 6,5 mm
  const diametro = ct => 6.5 * Math.cbrt(ct);
  const dec = (v, n) => v.toFixed(n).replace('.', ',');

  /* Distribuidor oficial y garantia, por marca. Nada del proyecto los respalda
     todavia: va el minimo legal (2 anos, Ley 23/2003) y la tabla por marca queda
     vacia hasta que el cliente confirme cada acuerdo. Es el unico sitio donde se
     tocan: 'Marca': ['Distribuidora', anos]. */
  const AVAL = { defecto: ['Joyería Mapy', 2], marcas: {
    // 'Citizen': ['Citizen España', 5],   <- pendiente de confirmar
  } };

  // mismo aspecto que REFERENCIA o DETALLES en la ficha real
  const bloqueFicha = (rotulo, cuerpo) =>
    '<div class="mapy-bloque"><span class="titpro">' + rotulo + '</span>' + cuerpo + '</div>';

  function tecnica(p) {
    const filas = (p.car && p.car.length) ? p.car : (p.sp || []);
    if (!filas.length) return '';
    return bloqueFicha('FICHA TÉCNICA', '<dl class="mapy-tecnica">' + filas.map(f =>
      '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') + '</dl>');
  }

  function aval(marca) {
    const [dist, anos] = AVAL.marcas[marca] || AVAL.defecto;
    return bloqueFicha('DISTRIBUIDOR OFICIAL Y GARANTÍA', '<p class="mapy-aval">' + esc(dist) +
      ' · ' + anos + (anos === 1 ? ' año' : ' años') + ' de garantía</p>');
  }

  // los acabados de un mismo modelo: cada uno es su propia ficha
  function acabados(p) {
    const grupo = p.base ? GRUPO.get(p.base) : null;
    if (!grupo || grupo.length < 2) return '';
    return bloqueFicha('ACABADO', '<div class="mapy-acabados mapy-acabados--ficha">' + grupo.map(v =>
      '<a class="mapy-acabado" href="#' + v.ruta + '" aria-current="' + (v.id === p.id) +
      '" title="' + esc(v.r) + ' · ' + esc(v.pt) + '">' + esc(v.v) + '</a>').join('') +
      '<span>' + grupo.length + ' acabados · cambia la foto y el precio</span></div>');
  }

  // el dibujo solo vale si los quilates son de una sola piedra: en pendientes son
  // dos y en un collar riviere son muchas, y enganaria
  const unaPiedra = p => /(anillo|solitario)/i.test(p.n) && !/(pendientes|collar|colgante|pulsera)/i.test(p.n);

  function figuraDiamante(ct, mayor) {
    const mm = diametro(ct), escala = 110 / diametro(mayor);
    const radio = mm * escala / 2;
    return '<svg viewBox="-60 -60 120 120" aria-hidden="true">' +
      '<circle r="' + (diametro(mayor) * escala / 2).toFixed(1) + '" class="mapy-diamante__guia"/>' +
      '<g class="mapy-diamante__piedra" style="transform:scale(' + (radio / 57) + ')">' +
        '<circle r="57"/><polygon points="0,-57 40,-40 57,0 40,40 0,57 -40,40 -57,0 -40,-40"/>' +
        '<polygon points="0,-30 21,-21 30,0 21,21 0,30 -21,21 -30,0 -21,-21"/>' +
        '<path d="M0-57L21-21M40-40L30 0M57 0L21 21M40 40L0 30M0 57L-21 21M-40 40L-30 0M-57 0L-21-21M-40-40L0-30' +
        'M0-57L-21-21M40-40L21-21M57 0L30 0M40 40L21 21M0 57L0 30M-40 40L-21 21M-57 0L-30 0M-40-40L-21-21"/>' +
      '</g></svg><figcaption><b>' + dec(mm, 1) + ' mm</b> de diámetro para <b>' + dec(ct, 2) + ' ct</b>' +
      '<span>Talla brillante redonda, a escala frente a ' + dec(mayor, 2) + ' ct, el mayor de esta pieza.</span>' +
      '</figcaption>';
  }

  // en los listados, los acabados cambian la tarjeta y a donde lleva
  document.addEventListener('click', e => {
    const acabado = e.target.closest('.product_list .mapy-acabado');
    if (!acabado) return;
    e.preventDefault();
    const li = acabado.closest('li.ajax_block_product');
    const v = PROD.get(acabado.dataset.id);
    li.dataset.id = v.id;
    $$('img', li).forEach(img => { if (v.il) { img.dataset.foto = v.il; cargarFoto(img); } });
    $$('.product-price', li).forEach(s => { s.textContent = ' ' + v.pt + ' '; });
    $$('.product_img_link, .nombre a', li).forEach(a => a.setAttribute('href', '#' + v.ruta));
    $$('.mapy-acabado', li).forEach(b => b.setAttribute('aria-pressed', b === acabado));
  });

  /* -------------------------------------------------- otras paginas */

  function pagina(ruta) {
    const t = D.paginas[ruta];
    preparar(t.body_id, t.body_class, t.columnas, t.css);
  }

  function noIncluida(ruta) {
    preparar('cms', 'cms hide-left-column hide-right-column lang_es',
      '<div class="breadcrumb clearfix"> <a class="home" href="#/es/" title="Volver a Inicio">INICIO</a></div>' +
      '<div class="mapy-fuera"><p>Esta página no forma parte de la vista previa del catálogo.</p>' +
      '<p><a href="#/es/">Volver al inicio</a></p></div>');
  }

  /* ------------------------------------------------------- cabecera */

  function cerrarCapas() {
    $$('.sfHover').forEach(li => li.classList.remove('sfHover'));
    $$('#block_top_menu .submenu-container').forEach(u => { u.style.display = 'none'; });
  }

  function aviso(texto) {
    let t = $('#mapy-aviso');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mapy-aviso';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = texto;
    t.classList.add('visible');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('visible'), 3200);
  }

  function montarCabecera() {
    // el JS de la tienda fija la cabecera en movil con la clase "mobile"
    const cabecera = $('#header');
    const ajustarCabecera = () => { if (cabecera) cabecera.classList.toggle('mobile', window.innerWidth < 768); };
    ajustarCabecera();
    window.addEventListener('resize', ajustarCabecera);

    $$('#block_top_menu ul.sf-menu > li').forEach(li => {
      const sub = $(':scope > ul', li);
      if (!sub) return;
      li.addEventListener('mouseenter', () => { li.classList.add('sfHover'); sub.style.display = 'block'; });
      li.addEventListener('mouseleave', () => { li.classList.remove('sfHover'); sub.style.display = 'none'; });
    });

    // el tema repite el menu (escritorio y movil) con los mismos id
    $$('#block_top_menu .cat-title').forEach(boton => boton.addEventListener('click', () => {
      boton.classList.toggle('active');
      const ul = $('ul.sf-menu', boton.parentElement);
      if (ul) ul.style.display = getComputedStyle(ul).display === 'none' ? 'block' : 'none';
    }));

    const cajaBuscar = $('#search_block_top');
    $$('#buscar').forEach(buscar => buscar.addEventListener('click', () => {
      if (!cajaBuscar) return;
      const oculto = getComputedStyle(cajaBuscar).display === 'none';
      cajaBuscar.style.display = oculto ? 'block' : 'none';
      if (oculto) { const i = $('#search_query_top'); if (i) i.focus(); }
    }));
    $$('#exitsearch').forEach(x => x.addEventListener('click', () => {
      if (cajaBuscar) cajaBuscar.style.display = 'none';
    }));
    const form = $('#searchbox');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const i = $('input[name="search_query"]', form);
      ir('/es/buscar', { search_query: i ? i.value.trim() : '' });
    });

    const idioma = $('#languages-block-top .current');
    const idiomas = $('#first-languages');
    if (idioma && idiomas) idioma.addEventListener('click', () => {
      idiomas.style.display = getComputedStyle(idiomas).display === 'none' ? 'block' : 'none';
    });

    const carrito = $('#cartshop');
    const cesta = $('#cestashow');
    if (carrito && cesta) {
      carrito.addEventListener('mouseenter', () => { cesta.style.display = 'block'; });
      carrito.addEventListener('mouseleave', () => { cesta.style.display = 'none'; });
    }

    // la franja promocional alterna los dos mensajes en movil
    const promo = $$('.banner.visible-xs .promosmsg > div');
    if (promo.length === 2) {
      let k = 0;
      setInterval(() => {
        k = 1 - k;
        promo[0].style.display = k ? 'none' : '';
        promo[1].style.display = k ? '' : 'none';
      }, 4000);
    }
  }

  /* ------------------------------------------- enlaces y formularios */

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === 'javascript:history.back()') { e.preventDefault(); history.back(); return; }
    if (/^javascript:/i.test(href) || href === '#') { e.preventDefault(); return; }
    if (/^https?:\/\//i.test(href) && !/joyeriamapy\.com/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  });

  document.addEventListener('submit', e => {
    if (e.target.id === 'searchbox' || e.target.matches('.showall, .nbrItemPage, .productsSortForm')) {
      if (e.target.id !== 'searchbox') e.preventDefault();
      return;
    }
    e.preventDefault();
    aviso('Vista previa: los formularios y la compra están desactivados.');
  }, true);

  document.addEventListener('click', e => {
    if (e.target.closest('#btncontact')) {
      e.preventDefault();
      const f = $('.formesp', columnas);
      if (f) f.style.display = getComputedStyle(f).display === 'none' ? 'block' : 'none';
    }
    if (e.target.closest('#btnshop, .buyend, #wishlist_button, .ajax_add_to_cart_button, #newsletter-input ~ button')) {
      if (!e.target.closest('#btncontact')) {
        e.preventDefault();
        aviso('Vista previa: la compra está desactivada.');
      }
    }
  });

  Object.values(D.categorias).forEach(c => { c.set = new Set(c.productos); });
  Object.keys(D.genero).forEach(k => { D.genero[k] = new Set(D.genero[k]); });
  // tras elegir combinacion, el JS de la tienda reescribe el precio con otro formato: "€ 12,600"
  D.formatoCombinacion = v => '€ ' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  montarCabecera();
  window.addEventListener('hashchange', pintar);
  pintar();
  document.documentElement.classList.remove('mapy-cargando');
})();
