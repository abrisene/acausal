# Visualizing Markov Chains

This guide covers exporting and visualizing Markov chains using various tools including D3.js, Cytoscape, Graphviz, and custom solutions (v4.0 features).

**📚 Documentation Guide:**
- This is the **technical integration guide** for visualization libraries and export formats
- For **game development examples**, see [Debugging & Analytics](./debugging.md) - Model inspection, testing, and analytics for game development
- For basic usage, start with the [Markov Chain Quickstart](./markov.md)

## Table of Contents

- [Graph Export Overview](#graph-export-overview)
- [Export Formats](#export-formats)
- [D3.js Integration](#d3js-integration)
- [Cytoscape Integration](#cytoscape-integration)
- [Graphviz Integration](#graphviz-integration)
- [Custom Visualizations](#custom-visualizations)
- [Interactive Examples](#interactive-examples)

---

## Graph Export Overview

### The `exportAsGraph()` Method

The `exportAsGraph()` method converts your Markov chain into a node-edge graph structure suitable for visualization:

```typescript
import { MarkovChain } from 'acausal';

const chain = new MarkovChain({ maxOrder: 2 });
chain.addSequences([
  ['home', 'products', 'cart', 'checkout'],
  ['home', 'search', 'products', 'cart'],
  ['home', 'products', 'details', 'exit']
]);

const graph = chain.exportAsGraph();

console.log(graph);
// {
//   nodes: [
//     { id: 'home', order: 1, frequency: 15, states: ['home'] },
//     { id: 'home⏐products', order: 2, frequency: 10, states: ['home', 'products'] },
//     ...
//   ],
//   edges: [
//     { from: 'home', to: 'products', weight: 8, probability: 0.8 },
//     { from: 'home', to: 'search', weight: 2, probability: 0.2 },
//     ...
//   ],
//   metadata: {
//     maxOrder: 2,
//     totalGrams: 25,
//     totalSequences: 3
//   }
// }
```

### Understanding the Structure

**Nodes** represent states or n-grams:
- `id`: Unique identifier (states joined by delimiter)
- `order`: N-gram order (1 = single state, 2 = bigram, etc.)
- `frequency`: How often this n-gram appears
- `states`: Array of state values

**Edges** represent transitions:
- `from`: Source node ID
- `to`: Target state
- `weight`: Raw transition count
- `probability`: Normalized transition probability (0-1)

**Metadata** provides context:
- `maxOrder`: Maximum n-gram order in the chain
- `totalGrams`: Total number of unique n-grams
- `totalSequences`: Number of training sequences

---

## Export Formats

### JSON Export

Simple, portable format for external analysis:

```typescript
const json = chain.toJSON();

// Structure:
// {
//   metadata: { maxOrder, delimiter, totalGrams, totalSequences },
//   grams: [
//     { pattern: ['state1', 'state2'], order: 2, frequency: 5, next: {...} }
//   ]
// }

// Save to file
import fs from 'fs';
fs.writeFileSync('chain.json', JSON.stringify(json, null, 2));
```

### DOT Format (Graphviz)

```typescript
function exportToDOT(chain: MarkovChain): string {
  const graph = chain.exportAsGraph();

  let dot = 'digraph MarkovChain {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=circle];\n\n';

  // Add nodes
  graph.nodes.forEach(node => {
    const label = node.states.join('\\n');
    const size = Math.log(node.frequency + 1) * 0.5;
    dot += `  "${node.id}" [label="${label}", width=${size}];\n`;
  });

  dot += '\n';

  // Add edges
  graph.edges.forEach(edge => {
    const weight = (edge.probability * 5).toFixed(1);
    const label = (edge.probability * 100).toFixed(0) + '%';
    dot += `  "${edge.from}" -> "${edge.to}" [label="${label}", penwidth=${weight}];\n`;
  });

  dot += '}\n';
  return dot;
}

// Usage
const dot = exportToDOT(chain);
fs.writeFileSync('chain.dot', dot);
// Render: dot -Tpng chain.dot -o chain.png
```

### CSV Export

For spreadsheet analysis:

```typescript
function exportToCSV(chain: MarkovChain): { nodes: string; edges: string } {
  const graph = chain.exportAsGraph();

  // Nodes CSV
  const nodeHeaders = 'id,order,frequency,states\n';
  const nodeRows = graph.nodes.map(n =>
    `"${n.id}",${n.order},${n.frequency},"${n.states.join(' ')}"`
  ).join('\n');

  // Edges CSV
  const edgeHeaders = 'from,to,weight,probability\n';
  const edgeRows = graph.edges.map(e =>
    `"${e.from}","${e.to}",${e.weight},${e.probability}`
  ).join('\n');

  return {
    nodes: nodeHeaders + nodeRows,
    edges: edgeHeaders + edgeRows
  };
}

// Usage
const csv = exportToCSV(chain);
fs.writeFileSync('nodes.csv', csv.nodes);
fs.writeFileSync('edges.csv', csv.edges);
```

### GML Format

For network analysis tools (Gephi, NetworkX):

```typescript
function exportToGML(chain: MarkovChain): string {
  const graph = chain.exportAsGraph();

  let gml = 'graph [\n';
  gml += '  directed 1\n';

  // Add nodes
  graph.nodes.forEach((node, i) => {
    gml += '  node [\n';
    gml += `    id ${i}\n`;
    gml += `    label "${node.id}"\n`;
    gml += `    frequency ${node.frequency}\n`;
    gml += `    order ${node.order}\n`;
    gml += '  ]\n';
  });

  // Create node ID mapping
  const nodeIds = new Map(graph.nodes.map((n, i) => [n.id, i]));

  // Add edges
  graph.edges.forEach(edge => {
    const sourceId = nodeIds.get(edge.from);
    const targetId = nodeIds.get(edge.to);

    if (sourceId !== undefined && targetId !== undefined) {
      gml += '  edge [\n';
      gml += `    source ${sourceId}\n`;
      gml += `    target ${targetId}\n`;
      gml += `    weight ${edge.weight}\n`;
      gml += `    probability ${edge.probability}\n`;
      gml += '  ]\n';
    }
  });

  gml += ']\n';
  return gml;
}

// Usage
const gml = exportToGML(chain);
fs.writeFileSync('chain.gml', gml);
```

---

## D3.js Integration

### Force-Directed Graph

```typescript
// Convert to D3 format
function toD3Format(chain: MarkovChain) {
  const graph = chain.exportAsGraph();

  return {
    nodes: graph.nodes.map(n => ({
      id: n.id,
      label: n.states[n.states.length - 1] || n.id,
      size: Math.log(n.frequency + 1) * 10,
      order: n.order
    })),
    links: graph.edges.map(e => ({
      source: e.from,
      target: e.to,
      value: e.weight,
      strength: e.probability
    }))
  };
}

// D3.js visualization code
const d3Data = toD3Format(chain);

const svg = d3.select('svg');
const width = +svg.attr('width');
const height = +svg.attr('height');

const simulation = d3.forceSimulation(d3Data.nodes)
  .force('link', d3.forceLink(d3Data.links)
    .id(d => d.id)
    .strength(d => d.strength))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width / 2, height / 2));

const link = svg.append('g')
  .selectAll('line')
  .data(d3Data.links)
  .enter().append('line')
  .attr('stroke-width', d => Math.sqrt(d.value))
  .attr('stroke', '#999');

const node = svg.append('g')
  .selectAll('circle')
  .data(d3Data.nodes)
  .enter().append('circle')
  .attr('r', d => d.size)
  .attr('fill', d => d3.schemeCategory10[d.order % 10])
  .call(d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended));

node.append('title')
  .text(d => d.label);

simulation.on('tick', () => {
  link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  node
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);
});

function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}
```

### Sankey Diagram

Perfect for visualizing flow probabilities:

```typescript
function toSankeyFormat(chain: MarkovChain) {
  const graph = chain.exportAsGraph();

  // Create unique nodes
  const nodeMap = new Map();
  let nodeIndex = 0;

  graph.nodes.forEach(n => {
    if (!nodeMap.has(n.id)) {
      nodeMap.set(n.id, {
        id: nodeIndex++,
        name: n.id
      });
    }
  });

  // Create links
  const links = graph.edges.map(e => ({
    source: nodeMap.get(e.from).id,
    target: nodeMap.get(e.to).id,
    value: e.weight
  }));

  return {
    nodes: Array.from(nodeMap.values()),
    links
  };
}

// D3 Sankey visualization
const sankeyData = toSankeyFormat(chain);

const sankey = d3.sankey()
  .nodeWidth(15)
  .nodePadding(10)
  .extent([[1, 1], [width - 1, height - 5]]);

const {nodes, links} = sankey({
  nodes: sankeyData.nodes.map(d => Object.assign({}, d)),
  links: sankeyData.links.map(d => Object.assign({}, d))
});

svg.append("g")
  .selectAll("rect")
  .data(nodes)
  .join("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", "steelblue");

svg.append("g")
  .selectAll("path")
  .data(links)
  .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke-width", d => Math.max(1, d.width))
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-opacity", 0.2);
```

### Hierarchical Tree

For visualizing order-based structure:

```typescript
function toTreeFormat(chain: MarkovChain) {
  const graph = chain.exportAsGraph();

  // Group by order
  const levels = new Map();
  graph.nodes.forEach(n => {
    if (!levels.has(n.order)) {
      levels.set(n.order, []);
    }
    levels.get(n.order).push(n);
  });

  // Build tree structure
  const root = {
    name: 'root',
    children: levels.get(1)?.map(n => ({
      name: n.id,
      value: n.frequency,
      children: graph.edges
        .filter(e => e.from === n.id)
        .map(e => ({
          name: e.to,
          value: e.weight
        }))
    })) || []
  };

  return root;
}

// D3 tree visualization
const treeData = toTreeFormat(chain);

const treeLayout = d3.tree().size([height, width - 160]);
const root = d3.hierarchy(treeData);
treeLayout(root);

svg.selectAll('.link')
  .data(root.links())
  .enter().append('path')
    .attr('class', 'link')
    .attr('d', d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x));

svg.selectAll('.node')
  .data(root.descendants())
  .enter().append('circle')
    .attr('class', 'node')
    .attr('cx', d => d.y)
    .attr('cy', d => d.x)
    .attr('r', 4);
```

---

## Cytoscape Integration

### Basic Setup

```typescript
function toCytoscapeFormat(chain: MarkovChain) {
  const graph = chain.exportAsGraph();

  return {
    elements: {
      nodes: graph.nodes.map(n => ({
        data: {
          id: n.id,
          label: n.states.join(' → '),
          weight: n.frequency,
          order: n.order
        }
      })),
      edges: graph.edges.map((e, i) => ({
        data: {
          id: `edge-${i}`,
          source: e.from,
          target: e.to,
          weight: e.probability,
          rawWeight: e.weight,
          label: `${(e.probability * 100).toFixed(0)}%`
        }
      }))
    }
  };
}

// Cytoscape.js configuration
const cyData = toCytoscapeFormat(chain);

const cy = cytoscape({
  container: document.getElementById('cy'),

  elements: cyData.elements,

  style: [
    {
      selector: 'node',
      style: {
        'background-color': '#666',
        'label': 'data(label)',
        'width': 'mapData(weight, 0, 100, 20, 80)',
        'height': 'mapData(weight, 0, 100, 20, 80)',
        'font-size': '12px',
        'text-valign': 'center',
        'text-halign': 'center'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'mapData(weight, 0, 1, 1, 10)',
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-size': '10px',
        'text-rotation': 'autorotate'
      }
    }
  ],

  layout: {
    name: 'cose',
    idealEdgeLength: 100,
    nodeOverlap: 20,
    refresh: 20,
    fit: true,
    padding: 30,
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion: 400000,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  }
});
```

### Custom Styling

```typescript
const styleConfig = {
  // Color nodes by order
  colorByOrder: () => ({
    selector: 'node',
    style: {
      'background-color': (ele) => {
        const order = ele.data('order');
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        return colors[order % colors.length];
      }
    }
  }),

  // Size by frequency
  sizeByFrequency: () => ({
    selector: 'node',
    style: {
      'width': 'mapData(weight, 0, 100, 30, 100)',
      'height': 'mapData(weight, 0, 100, 30, 100)'
    }
  }),

  // Edge thickness by probability
  edgeByProbability: () => ({
    selector: 'edge',
    style: {
      'width': 'mapData(weight, 0, 1, 2, 12)',
      'opacity': 'mapData(weight, 0, 1, 0.3, 1)'
    }
  })
};

cy.style([
  styleConfig.colorByOrder(),
  styleConfig.sizeByFrequency(),
  styleConfig.edgeByProbability()
]);
```

### Interactive Features

```typescript
// Click to highlight path
cy.on('tap', 'node', function(evt) {
  const node = evt.target;

  // Highlight connected edges
  cy.edges().removeClass('highlighted');
  node.connectedEdges().addClass('highlighted');

  // Show info panel
  showNodeInfo(node.data());
});

// Hover effects
cy.on('mouseover', 'node', function(evt) {
  const node = evt.target;
  node.style('background-color', '#e74c3c');
});

cy.on('mouseout', 'node', function(evt) {
  const node = evt.target;
  node.style('background-color', '#666');
});

// Path tracing
function highlightPath(startId, endId) {
  const aStar = cy.elements().aStar({
    root: `#${startId}`,
    goal: `#${endId}`
  });

  if (aStar.found) {
    aStar.path.addClass('path-highlight');
  }
}
```

---

## Graphviz Integration

### DOT Language Export

```typescript
function exportToGraphviz(chain: MarkovChain, options = {}) {
  const graph = chain.exportAsGraph();

  const {
    rankdir = 'LR',
    nodeShape = 'circle',
    colorScheme = 'pastel19'
  } = options;

  let dot = `digraph MarkovChain {\n`;
  dot += `  rankdir=${rankdir};\n`;
  dot += `  node [shape=${nodeShape}];\n\n`;

  // Add nodes with attributes
  graph.nodes.forEach(node => {
    const label = node.states.join('\\n');
    const size = (Math.log(node.frequency + 1) * 0.5).toFixed(2);
    const color = (node.order % 9) + 1;

    dot += `  "${node.id}" [\n`;
    dot += `    label="${label}",\n`;
    dot += `    width=${size},\n`;
    dot += `    height=${size},\n`;
    dot += `    fillcolor="${colorScheme}${color}",\n`;
    dot += `    style=filled\n`;
    dot += `  ];\n`;
  });

  dot += '\n';

  // Add edges with weights
  graph.edges.forEach(edge => {
    const weight = (edge.probability * 5).toFixed(1);
    const label = `${(edge.probability * 100).toFixed(0)}%`;

    dot += `  "${edge.from}" -> "${edge.to}" [\n`;
    dot += `    label="${label}",\n`;
    dot += `    penwidth=${weight},\n`;
    dot += `    weight=${edge.weight}\n`;
    dot += `  ];\n`;
  });

  dot += '}\n';
  return dot;
}

// Generate different layouts
const layouts = ['dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi'];

layouts.forEach(layout => {
  const dot = exportToGraphviz(chain, { rankdir: 'TB' });
  fs.writeFileSync(`chain-${layout}.dot`, dot);

  // Render: dot -Kneato -Tpng chain-neato.dot -o chain-neato.png
});
```

### Subgraph Clustering

```typescript
function exportWithClusters(chain: MarkovChain) {
  const graph = chain.exportAsGraph();

  // Group nodes by order
  const clusters = new Map();
  graph.nodes.forEach(n => {
    if (!clusters.has(n.order)) {
      clusters.set(n.order, []);
    }
    clusters.get(n.order).push(n);
  });

  let dot = 'digraph MarkovChain {\n';
  dot += '  rankdir=LR;\n\n';

  // Create subgraphs for each order
  clusters.forEach((nodes, order) => {
    dot += `  subgraph cluster_${order} {\n`;
    dot += `    label="Order ${order}";\n`;
    dot += '    style=filled;\n';
    dot += '    color=lightgrey;\n\n';

    nodes.forEach(n => {
      const label = n.states.join('\\n');
      dot += `    "${n.id}" [label="${label}"];\n`;
    });

    dot += '  }\n\n';
  });

  // Add edges
  graph.edges.forEach(e => {
    const label = `${(e.probability * 100).toFixed(0)}%`;
    dot += `  "${e.from}" -> "${e.to}" [label="${label}"];\n`;
  });

  dot += '}\n';
  return dot;
}
```

---

## Custom Visualizations

### Canvas-Based Visualization

```typescript
class MarkovCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private graph: ReturnType<MarkovChain['exportAsGraph']>;

  constructor(canvas: HTMLCanvasElement, chain: MarkovChain) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.graph = chain.exportAsGraph();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate positions
    const positions = this.calculatePositions();

    // Draw edges
    this.graph.edges.forEach(edge => {
      this.drawEdge(
        positions.get(edge.from)!,
        positions.get(edge.to)!,
        edge.probability
      );
    });

    // Draw nodes
    this.graph.nodes.forEach(node => {
      this.drawNode(
        positions.get(node.id)!,
        node.states.join(' '),
        node.frequency
      );
    });
  }

  private calculatePositions(): Map<string, {x: number, y: number}> {
    const positions = new Map();
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Simple circular layout
    const radius = Math.min(width, height) * 0.4;
    const centerX = width / 2;
    const centerY = height / 2;

    this.graph.nodes.forEach((node, i) => {
      const angle = (i / this.graph.nodes.length) * 2 * Math.PI;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    return positions;
  }

  private drawNode(pos: {x: number, y: number}, label: string, size: number) {
    const radius = Math.log(size + 1) * 5 + 10;

    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = '#3498db';
    this.ctx.fill();
    this.ctx.strokeStyle = '#2c3e50';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, pos.x, pos.y);
  }

  private drawEdge(from: {x: number, y: number}, to: {x: number, y: number}, probability: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.strokeStyle = `rgba(52, 73, 94, ${probability})`;
    this.ctx.lineWidth = probability * 5;
    this.ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowSize = 10;

    this.ctx.beginPath();
    this.ctx.moveTo(to.x, to.y);
    this.ctx.lineTo(
      to.x - arrowSize * Math.cos(angle - Math.PI / 6),
      to.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      to.x - arrowSize * Math.cos(angle + Math.PI / 6),
      to.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fillStyle = `rgba(52, 73, 94, ${probability})`;
    this.ctx.fill();
  }
}

// Usage
const canvas = document.getElementById('markov-canvas') as HTMLCanvasElement;
const renderer = new MarkovCanvasRenderer(canvas, chain);
renderer.render();
```

### ASCII Visualization

```typescript
function renderASCII(chain: MarkovChain, maxWidth: number = 80): string {
  const graph = chain.exportAsGraph();
  let output = '';

  // Group by order
  const byOrder = new Map();
  graph.nodes.forEach(n => {
    if (!byOrder.has(n.order)) byOrder.set(n.order, []);
    byOrder.get(n.order).push(n);
  });

  // Render each order level
  byOrder.forEach((nodes, order) => {
    output += `\nOrder ${order}:\n`;
    output += '─'.repeat(maxWidth) + '\n';

    nodes.forEach(node => {
      const label = node.states.join(' → ');
      const bar = '█'.repeat(Math.min(50, Math.log(node.frequency + 1) * 5));

      output += `  ${label.padEnd(30)} ${bar} (${node.frequency})\n`;

      // Show top transitions
      const edges = graph.edges
        .filter(e => e.from === node.id)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);

      edges.forEach(e => {
        const prob = (e.probability * 100).toFixed(0);
        const arrow = '→'.repeat(Math.ceil(e.probability * 10));
        output += `    ${arrow} ${e.to} (${prob}%)\n`;
      });
    });
  });

  return output;
}

// Usage
console.log(renderASCII(chain));
```

---

## Interactive Examples

### React Component

```typescript
import React, { useEffect, useRef } from 'react';
import { MarkovChain } from 'acausal';
import cytoscape from 'cytoscape';

interface Props {
  chain: MarkovChain;
}

export const MarkovVisualization: React.FC<Props> = ({ chain }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = chain.exportAsGraph();

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: {
        nodes: graph.nodes.map(n => ({
          data: { id: n.id, label: n.states.join(' → '), weight: n.frequency }
        })),
        edges: graph.edges.map((e, i) => ({
          data: { id: `e${i}`, source: e.from, target: e.to, weight: e.probability }
        }))
      },
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'width': 'mapData(weight, 0, 100, 30, 80)',
            'height': 'mapData(weight, 0, 100, 30, 80)',
            'background-color': '#3498db'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 'mapData(weight, 0, 1, 2, 10)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: { name: 'cose' }
    });

    return () => {
      cyRef.current?.destroy();
    };
  }, [chain]);

  return <div ref={containerRef} style={{ width: '100%', height: '600px' }} />;
};
```

### Vue Component

```vue
<template>
  <div ref="container" class="markov-viz"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { MarkovChain } from 'acausal';
import cytoscape from 'cytoscape';

const props = defineProps<{ chain: MarkovChain }>();
const container = ref<HTMLDivElement>();
let cy: cytoscape.Core | null = null;

onMounted(() => {
  if (!container.value) return;

  const graph = props.chain.exportAsGraph();

  cy = cytoscape({
    container: container.value,
    elements: {
      nodes: graph.nodes.map(n => ({
        data: { id: n.id, label: n.states.join(' → ') }
      })),
      edges: graph.edges.map((e, i) => ({
        data: { id: `e${i}`, source: e.from, target: e.to }
      }))
    },
    layout: { name: 'cose' }
  });
});

watch(() => props.chain, () => {
  cy?.destroy();
  // Re-initialize with new chain
});
</script>

<style scoped>
.markov-viz {
  width: 100%;
  height: 600px;
  border: 1px solid #ccc;
}
</style>
```

---

## Next Steps

- [Advanced Features](./advanced.md) - Scoring, constraints, pattern analysis
- [Main Documentation](./markov.md) - Core Markov chain features
- [Examples](../examples/import-export.ts) - Complete visualization examples

For more visualization libraries and techniques, see:
- [D3.js Gallery](https://observablehq.com/@d3/gallery)
- [Cytoscape.js Demos](https://js.cytoscape.org/demos/)
- [Graphviz Documentation](https://graphviz.org/documentation/)
