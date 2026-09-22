"use client";

import { Component } from "react";

export default class ConvexErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="am-access-boundary" role="alert">
      <p className="am-eyebrow">Connexion sécurisée</p>
      <h2>{this.props.title || "Ce suivi est momentanément indisponible."}</h2>
      <p>{this.props.body || "Réessaie dans quelques instants. Aucune réservation n’a été modifiée."}</p>
      <button className="am-button" type="button" onClick={() => window.location.reload()}>Réessayer</button>
    </section>;
  }
}
