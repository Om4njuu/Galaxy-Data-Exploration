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
  spectral.forEach(s => sel.append('option').attr('value', s).text(s));

  d3.select('#brightness').on('input', applyFilters);
  sel.on('change', applyFilters);
  d3.select('#search').on('input', onSearch);
  d3.select('#reset').on('click', ()=>zoom.transform(svg, d3.zoomIdentity));
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
  simulation = d3.forceSimulation(data)
    .force('center', d3.forceCenter(400,300))
    .force('charge', d3.forceManyBody().strength(d => -Math.max(5, d.size*2)))
    .force('collision', d3.forceCollide().radius(d => d.size*3))
    .force('x', d3.forceX().strength(0.02).x(d => d.cluster * 120 + 200))
    .force('y', d3.forceY().strength(0.02).y(300));

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
  });
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
