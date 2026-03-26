import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const svg = d3.select('#galaxy');
const width = svg.node().clientWidth || 960;
const height = svg.node().clientHeight || 600;
svg.attr('viewBox', `0 0 ${Math.max(width,800)} ${Math.max(height,600)}`);

const g = svg.append('g');

const tooltip = d3.select('#tooltip');
const sidebar = d3.select('#details');

let nodes = [];

function colorForSpectral(s){
  const map = {O:'#9bb0ff',B:'#aabfff',A:'#cad7ff',F:'#f8f7ff',G:'#fff4ea',K:'#ffd2a1',M:'#ffcc6f'};
  return map[s] || '#ddd';
}


function load(){
  return fetch('data/sample-astronomical.json').then(r=>r.json());
}

function setupControls(data){
  nodes = data;
  const spectral = Array.from(new Set(data.map(d=>d.spectral))).sort();
  const sel = d3.select('#spectral-filter');
  sel.selectAll('option').filter(function(){return this.value!=='all';}).remove();
  spectral.forEach(s => sel.append('option').attr('value', s).text(s));

  d3.select('#brightness').on('input', applyFilters);
  sel.on('change', applyFilters);
  d3.select('#search').on('input', onSearch);
  d3.select('#reset').on('click', ()=>zoom.transform(svg, d3.zoomIdentity));
  d3.select('#show-clusters').on('change', ()=>{
    const vis = d3.select('#show-clusters').property('checked');
    g.selectAll('text.cluster-label').attr('display', vis ? null : 'none');
  });
  d3.select('#upload').on('change', handleUpload);
  drawLegend(data);
}

function applyFilters(){
  const minB = +d3.select('#brightness').node().value;
  const spec = d3.select('#spectral-filter').node().value;
  nodeSelection.attr('display', d => (d.brightness>=minB && (spec==='all' || d.spectral===spec)) ? null : 'none');
}

function onSearch(){
  const q = d3.select('#search').node().value.trim().toLowerCase();
  nodeSelection.classed('highlight', d => q && (d.name.toLowerCase().includes(q) || String(d.id)===q));
}

let simulation, nodeSelection;

function render(data){
  // create simulation with an added cluster force to pull nodes toward cluster centers
  const clusters = Array.from(new Set(data.map(d=>d.cluster))).sort((a,b)=>a-b);
  const clusterSpacing = 140;
  const centerX = 400;
  const centerY = 300;

  simulation = d3.forceSimulation(data)
    .force('center', d3.forceCenter(centerX, centerY))
    .force('charge', d3.forceManyBody().strength(d => -Math.max(6, d.size*2.5)))
    .force('collision', d3.forceCollide().radius(d => d.size*3.2))
    .force('x', d3.forceX().strength(0.01).x(d => centerX))
    .force('y', d3.forceY().strength(0.01).y(centerY))
    .force('cluster', clusterForce(clusters, centerX, centerY, clusterSpacing, 0.08));

  nodeSelection = g.selectAll('circle').data(data, d=>d.id).join('circle')
    .attr('class','star')
    .attr('r', d=>d.size)
    .attr('fill', d=>colorForSpectral(d.spectral))
    .on('mouseover', (event,d)=>{
      tooltip.classed('hidden', false).html(`<strong>${d.name}</strong><br/>Brightness: ${d.brightness}<br/>Spectral: ${d.spectral}`);
    })
    .on('mousemove', (event)=>{
      tooltip.style('left', (event.layerX + 12)+'px').style('top', (event.layerY + 12)+'px');
    })
    .on('mouseout', ()=>tooltip.classed('hidden', true))
    .on('click', (event,d)=>{
      sidebar.html(`<strong>${d.name}</strong><p>ID: ${d.id}</p><p>Brightness: ${d.brightness}</p><p>Size: ${d.size}</p><p>Spectral: ${d.spectral}</p><p>Cluster: ${d.cluster}</p>`);
    });

  simulation.on('tick', ()=>{
    nodeSelection.attr('cx', d=>d.x).attr('cy', d=>d.y);
    drawClusterLabels(data);
  });
}

// a custom force that nudges nodes toward their cluster center
function clusterForce(clusters, centerX=400, centerY=300, spacing=120, strength=0.05){
  // compute static centers along an arc for visual variety
  const angleStep = Math.PI * 2 / Math.max(1, clusters.length);
  const centers = new Map();
  clusters.forEach((c,i)=>{
    const angle = i * angleStep;
    const x = centerX + Math.cos(angle) * spacing * Math.min(3, clusters.length/2) ;
    const y = centerY + Math.sin(angle) * spacing * Math.min(3, clusters.length/2) ;
    centers.set(c, {x,y});
  });

  function force(alpha){
    for(const node of nodes){
      const c = centers.get(node.cluster);
      if(!c) continue;
      // pull a fraction of the distance, scaled by node size (larger nodes pull stronger)
      const k = strength * alpha;
      node.vx += (c.x - node.x) * k;
      node.vy += (c.y - node.y) * k;
    }
  }
  force.initialize = function(){ /* no-op */ };
  return force;
}

const zoom = d3.zoom().on('zoom', (e)=>g.attr('transform', e.transform));
svg.call(zoom).call(zoom.transform, d3.zoomIdentity);

load().then(data=>{
  setupControls(data);
  render(data);
}).catch(err=>{
  console.error('Failed loading data', err);
  d3.select('#details').text('Failed to load sample data. See console.');
});

function drawLegend(data){
  const counts = d3.rollup(data, v=>v.length, d=>d.spectral);
  const spectral = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]);
  const legend = d3.select('#legend');
  legend.html('');
  spectral.forEach(([s,count])=>{
    const item = legend.append('div').attr('class','legend-item');
    item.append('div').attr('class','legend-swatch').style('background', colorForSpectral(s));
    item.append('div').style('margin-left','6px').text(s).style('color','var(--muted)');
    item.append('div').attr('class','legend-count').text(count);
  });
}

// Cluster labels: place labels horizontally by cluster index
function drawClusterLabels(data){
  const clusters = Array.from(new Set(data.map(d=>d.cluster))).sort((a,b)=>a-b);
  // compute centroid of each cluster from current node positions
  const centroids = clusters.map(c=>{
    const members = data.filter(d=>d.cluster===c && !isNaN(d.x));
    if(members.length===0) return {cluster:c,x:0,y:0,count:0};
    const x = d3.mean(members, d=>d.x);
    const y = d3.mean(members, d=>d.y);
    return {cluster:c,x,y,count:members.length};
  });

  const labels = g.selectAll('g.cluster-label').data(centroids, d=>d.cluster);
  const entered = labels.join(
    enter => {
      const gnode = enter.append('g').attr('class','cluster-label');
      gnode.append('circle').attr('r', 26).attr('fill','rgba(255,255,255,0.02)');
      gnode.append('text').attr('class','cluster-label-text').attr('text-anchor','middle').attr('dy','0.35em').style('fill','rgba(255,255,255,0.9)').style('font-size','13px');
      return gnode;
    },
    update => update,
    exit => exit.remove()
  );

  // update positions and text
  g.selectAll('g.cluster-label').attr('transform', d=>`translate(${Math.max(40, d.x)}, ${Math.max(30, d.y)})`)
    .select('text.cluster-label-text').text(d=>`Cluster ${d.cluster} (${d.count})`);

  const vis = d3.select('#show-clusters').property ? d3.select('#show-clusters').property('checked') : true;
  g.selectAll('g.cluster-label').attr('display', vis ? null : 'none');
}

function handleUpload(event){
  const f = event.target.files && event.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const parsed = JSON.parse(e.target.result);
      if(!Array.isArray(parsed)) throw new Error('Expected JSON array of nodes');
      // basic schema validation
      const ok = parsed.every(d=>d.id!=null && d.name && d.brightness!=null && d.size!=null && d.spectral!=null && d.cluster!=null);
      if(!ok) throw new Error('Invalid node schema — each item needs id,name,brightness,size,spectral,cluster');
      // stop previous simulation
      if(simulation) simulation.stop();
      g.selectAll('*').remove();
      setupControls(parsed);
      render(parsed);
    }catch(err){
      alert('Failed to load dataset: '+err.message);
    }
  };
  reader.readAsText(f);
}
