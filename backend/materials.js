export const models = {
  axial: {
    fields: { force: [-10000, 10000], length: [0.001, 100], area: [1, 1e6], modulus: [1, 500] },
    solve({ force, length, area, modulus }) {
      const stress = force * 1000 / area; // N/mm² = MPa
      const strain = stress / (modulus * 1000);
      return { stress, strain, displacement: strain * length * 1000 };
    },
  },
  mohr: {
    fields: { sigmaX: [-5000, 5000], sigmaY: [-5000, 5000], tauXY: [-5000, 5000] },
    solve({ sigmaX, sigmaY, tauXY }) {
      const center = (sigmaX + sigmaY) / 2;
      const halfDifference = (sigmaX - sigmaY) / 2;
      const radius = Math.hypot(halfDifference, tauXY);
      return {
        center, radius,
        principalMax: center + radius,
        principalMin: center - radius,
        principalAngle: radius === 0 ? null : Math.atan2(tauXY, halfDifference) * 90 / Math.PI,
      };
    },
  },
};
