const width = window.innerWidth - 320
const height = window.innerHeight - 80

const svg = d3.select('#viz')
  .attr('width', width)
  .attr('height', height)

const container = svg.append('g')

const tooltip = d3.select('#tooltip')
const details = d3.select('#details-content')

let nodes = []
let simulation = null
let groupCenters = {}
let currentGroupAttr = '__auto'
let activeFilters = new Set()

const color = d3.scaleOrdinal(d3.schemeCategory10)

function resize(){
  const w = window.innerWidth - 320
  const h = window.innerHeight - 80
  svg.attr('width', w).attr('height', h)
}
window.addEventListener('resize', resize)

// zoom
svg.call(d3.zoom().scaleExtent([0.2, 8]).on('zoom', (event)=>{
  container.attr('transform', event.transform)
}))

function parseFiles(files){
  const readers = []
  const fileData = []
  for(const f of files){
    readers.push(new Promise((resolve)=>{
      const r = new FileReader()
      r.onload = ()=>{ resolve({name:f.name, text:r.result}) }
      r.readAsText(f)
    }))
  }
  Promise.all(readers).then(results=>{
    // detect CSV or JSON
    results.forEach(res=>{
      let parsed = null
      try{ parsed = JSON.parse(res.text) }
      catch(e){ parsed = d3.csvParse(res.text) }
      fileData.push({name:res.name, data:parsed})
    })
    handleLoadedFiles(fileData)
  })
}

function handleLoadedFiles(fileData){
  nodes = []
  fileData.forEach((file,i)=>{
    const arr = Array.isArray(file.data) ? file.data : (file.data.items || [])
    arr.forEach((d, idx)=>{
      // ensure numeric conversions where possible
      const obj = {...d}
      Object.keys(obj).forEach(k=>{ const n = +obj[k]; if(!isNaN(n)) obj[k]=n })
      nodes.push({
        id: `${i}-${idx}`,
        sourceFile: file.name,
        raw: obj
      })
    })
  })

  // populate group-attribute select with keys from first record
  populateGroupAttributes()
  updateVisualization()
}

function populateGroupAttributes(){
  const sel = d3.select('#group-attribute')
  sel.selectAll('option.attr').remove()
  const first = nodes.find(d=>d.raw && Object.keys(d.raw).length)
  if(!first) return
  const keys = Object.keys(first.raw)
  keys.forEach(k=> sel.append('option').attr('class','attr').attr('value',k).text(`Group by: ${k}`))
}

function computeGroups(){
  // Determine group value for each node
  nodes.forEach(n=>{
    if(currentGroupAttr==='__auto') n.group = n.sourceFile
    else n.group = (n.raw && n.raw[currentGroupAttr]!=null) ? String(n.raw[currentGroupAttr]) : 'unknown'
  })
  const groups = Array.from(new Set(nodes.map(d=>d.group)))
  // place group centers in a circle
  groupCenters = {}
  const R = Math.min(width,height)/3
  groups.forEach((g,i)=>{
    const angle = (i / groups.length) * 2 * Math.PI
    groupCenters[g] = {x: width/2 + Math.cos(angle)*R, y: height/2 + Math.sin(angle)*R}
  })
  updateFilterChips(groups)
}

function updateFilterChips(groups){
  const container = d3.select('#filters')
  container.selectAll('*').remove()
  groups.forEach(g=>{
    const btn = container.append('div').attr('class','filter-chip active').text(g)
    btn.on('click', ()=>{
      const el = d3.select(d3.event?.currentTarget || this)
      const active = el.classed('active')
      el.classed('active', !active)
      if(active) activeFilters.add(g) && activeFilters.delete(g)
      else { activeFilters.delete(g); }
      // recompute: show only active chips
      activeFilters = new Set()
      container.selectAll('.filter-chip').each(function(d,i){ if(d3.select(this).classed('active')) activeFilters.add(d3.select(this).text()) })
      updateCirclesVisibility()
    })
  })
}

function updateCirclesVisibility(){
  if(activeFilters.size===0){ d3.selectAll('circle.node').attr('opacity',1); return }
  d3.selectAll('circle.node').attr('opacity', d=> activeFilters.has(d.group) ? 1 : 0.08)
}

function updateVisualization(){
  computeGroups()
  // assign visual properties
  nodes.forEach(n=>{
    const b = typeof n.raw.brightness==='number' ? n.raw.brightness : (n.raw.brt||1)
    const s = typeof n.raw.size==='number' ? n.raw.size : (n.raw.sz||1)
    n.r = 3 + Math.sqrt(Math.max(0, +b || 1))
    n.radius = Math.max(2, Math.min(14, n.r))
    n.x = width/2 + (Math.random()-0.5)*50
    n.y = height/2 + (Math.random()-0.5)*50
  })

  if(simulation) simulation.stop()
  simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-8))
    .force('collide', d3.forceCollide().radius(d=>d.radius+1).iterations(2))
    .force('x', d3.forceX(d=>groupCenters[d.group].x).strength(0.08))
    .force('y', d3.forceY(d=>groupCenters[d.group].y).strength(0.08))
    .on('tick', ticked)

  const u = container.selectAll('circle.node').data(nodes, d=>d.id)
  u.join(
    enter=> enter.append('circle')
      .attr('class','node star')
      .attr('r', d=>d.radius)
      .attr('fill', d=> color(d.group))
      .on('mouseover', (event,d)=>{
        tooltip.style('left', (event.pageX+12)+'px').style('top', (event.pageY+12)+'px').classed('hidden',false)
          .html(`<strong>${d.group}</strong><br/>${Object.entries(d.raw).slice(0,6).map(([k,v])=>`${k}: ${v}`).join('<br/>')}`)
      })
      .on('mouseout', ()=> tooltip.classed('hidden',true))
      .on('click', (event,d)=>{ showDetails(d) })
    ,update=> update.attr('r', d=>d.radius).attr('fill', d=>color(d.group))
    ,exit=> exit.remove()
  )
}

function ticked(){
  container.selectAll('circle.node')
    .attr('cx', d=>d.x)
    .attr('cy', d=>d.y)
}

function showDetails(d){
  details.html(`<pre>${JSON.stringify(d.raw, null, 2)}</pre>`)
}

// wire UI
document.getElementById('file-input').addEventListener('change', (e)=>{
  if(e.target.files.length) parseFiles(e.target.files)
})

document.getElementById('group-attribute').addEventListener('change', (e)=>{
  currentGroupAttr = e.target.value
  updateVisualization()
})

document.getElementById('search').addEventListener('input', (e)=>{
  const q = e.target.value.toLowerCase().trim()
  if(!q) { d3.selectAll('circle.node').attr('stroke-width',0.3); return }
  d3.selectAll('circle.node').attr('stroke-width', d=> JSON.stringify(d.raw).toLowerCase().includes(q) ? 2 : 0.3).attr('opacity', d=> JSON.stringify(d.raw).toLowerCase().includes(q) ? 1 : 0.14)
})

// small sample load if no file provided
fetch('data/sample.json').then(r=>r.json()).then(j=>{
  // create a fake File-like load
  if(j && j.length){
    nodes = j.map((d,i)=>({id:`sample-${i}`, sourceFile:'sample.json', raw:d}))
    populateGroupAttributes(); updateVisualization()
  }
}).catch(()=>{})
