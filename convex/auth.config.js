const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

// The empty-provider state keeps local code generation/documentation possible
// before a Convex development deployment exists. A real deployment must set
// CLERK_JWT_ISSUER_DOMAIN before it can authenticate Clerk tokens.
const authConfig = {
  providers: issuerDomain
    ? [{ domain: issuerDomain, applicationID: "convex" }]
    : [],
};

export default authConfig;
