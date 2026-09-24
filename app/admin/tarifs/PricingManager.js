"use client";

import { useMutation, useQuery } from "convex/react";
import PriceEditor from "@/components/pricing/PriceEditor";

const GROUPS = [
  {
    title: "Cours et packs",
    description: "Montants payés pour les réservations d’anglais.",
    items: [
      { variantKey: "booking:anglais:solo", label: "Cours particulier", description: "Une séance individuelle d’une heure." },
      { variantKey: "booking:anglais:solo-4h", label: "Pack de 4 cours", description: "Prix total du pack." },
      { variantKey: "booking:anglais:solo-8h", label: "Pack de 8 cours", description: "Prix total du pack." },
      { variantKey: "booking:anglais:duo", label: "Cours en duo", description: "Prix total pour les deux personnes." },
    ],
  },
  {
    title: "Accompagnements sans rendez-vous",
    description: "Montants payés pour les dossiers et retours personnalisés.",
    items: [
      { variantKey: "request:review", label: "Review de book" },
      { variantKey: "request:contenu", label: "Direction de contenu" },
      { variantKey: "request:projet-animation", label: "Projet d’animation" },
      { variantKey: "request:feedback", label: "Feedback d’animation" },
    ],
  },
];

export default function PricingManager() {
  const catalog = useQuery("pricing:getAdminCatalog", {});
  const setPrice = useMutation("pricing:setPrice");

  if (catalog === undefined) return <p role="status">Chargement des tarifs…</p>;
  return <PriceEditor catalog={catalog} groups={GROUPS} onSave={setPrice} />;
}
