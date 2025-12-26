# Graph.Vibes - JanusGraph Visualizer

**Graph.Vibes** is a modern, interactive web-based visualizer for [JanusGraph](https://janusgraph.org/), built with [Next.js](https://nextjs.org/) and [react-force-graph](https://github.com/vasturiano/react-force-graph).

It provides a powerful interface to write Gremlin queries, visualize the results as a force-directed graph, and explore your data with advanced interactive features.

## 🚀 Features

-   **Interactive Visualization**: 2D force-directed graph with zoom, pan, and drag capabilities.
-   **Gremlin Console**: Write and execute raw Gremlin scripts directly from the UI.
-   **Smart Expansion**: Double-click any node to fetch and reveal its hidden neighbors (with configurable limit).
-   **Flexible Labeling**: Click any property in the details panel to instantly use it as the label for all nodes of that type.
-   **Theming**: Includes Light (Default), Dark, and Midnight themes with a glassmorphism aesthetic.
-   **Deep Customization**:
    -   Separate Node and Edge color palettes.
    -   Adjustable styling (Standard, Glass, Paper, Inverted).
    -   Toggleable Legend.
-   **Data Inspection**: Detailed side panel for inspecting node and edge properties.

## 🛠️ Prerequisites

-   **Node.js**: v14.x or higher (v18+ recommended).
-   **JanusGraph**: A running instance of JanusGraph Server (default: `localhost:8182`).

## 📦 Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/jgraph-viz.git
    cd jgraph-viz
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

## 🏃‍♂️ Usage

1.  **Start the development server**:
    ```bash
    npm run dev
    ```

2.  **Open the application**:
    Navigate to `http://localhost:3000` in your browser.

3.  **Connect to JanusGraph**:
    -   Click the **Connection** icon (WiFi symbol) in the header.
    -   Enter your JanusGraph server details (Default: `localhost` : `8182`).
    -   Click **Test Connection** to verify.

4.  **Visualize Data**:
    -   Enter a Gremlin query in the dedicated console at the bottom (e.g., `g.V().limit(100)`).
    -   Click **Run Query** (or Press `Ctrl/Cmd + Enter`).
    -   Explore the graph!

## 🎮 Interaction Guide

-   **Select Node/Edge**: Single-click an element to view its details in the right-hand panel.
-   **Expand Neighborhood**: **Double-click** a node to fetch and display its connected neighbors.
    -   *Config*: You can adjust the "Expansion Limit" in the Settings.
-   **Set Node Labels**:
    1.  Click a node to open details.
    2.  **Click on any property name** (e.g., `name`, `age`, `city`) in the list.
    3.  All nodes of that type will update to use that property as their label.
    4.  Click again to revert to showing the Node ID.
-   **Pan/Zoom**: Click and drag background to pan; Scroll to zoom.
-   **Fit View**: Click the **Locate** icon (Target symbol) to center the graph.

## ⚙️ Configuration

Global settings can be accessed via the **Settings** icon (Tools symbol) in the header:
-   **Background Color**: Override theme defaults.
-   **Theme**: Switch between Light, Dark, and Midnight.
-   **Palettes**: Choose distinct color schemes for Nodes and Edges.
-   **Expansion Limit**: Set the max number of neighbors to fetch on double-click.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
