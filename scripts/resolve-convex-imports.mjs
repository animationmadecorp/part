export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (specifier.startsWith("./") && !specifier.endsWith(".js")) {
      return {
        ...(await defaultResolve(`${specifier}.js`, context, defaultResolve)),
        shortCircuit: true,
      };
    }
    throw error;
  }
}
