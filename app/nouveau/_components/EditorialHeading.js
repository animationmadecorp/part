import { Fragment } from "react";

export default function EditorialHeading({ hero }) {
  const titleLines = String(hero?.title || "").split(/\r?\n/).filter(Boolean);
  const emphasisPrefix = hero?.emphasisPrefix ? `${hero.emphasisPrefix} ` : "";
  return (
    <h1>
      {titleLines.map((line, index) => (
        <Fragment key={`${line}-${index}`}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
      {hero?.emphasis ? <><br />{emphasisPrefix}<em>{hero.emphasis}</em></> : null}
    </h1>
  );
}
