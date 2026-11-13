import { number } from './contract.js';

export const models = {
  axial: {
    definition: {
      id: 'axial',
      version: '1.0',
      inputs: {
        force: number('Axial force', 'kN', -10000, 10000),
        length: number('Length', 'm', 0.001, 100),
        area: number('Section area', 'mm²', 1, 1e6),
        modulus: number('Elastic modulus', 'GPa', 1, 500),
      },
      outputs: { summary: { stress: 'MPa', strain: '1', displacement: 'mm' }, series: {} },
    },
    /** @param {{force:number,length:number,area:number,modulus:number}} input */
    solve({ force, length, area, modulus }) {
      const stress = ((force || 0) * 1000) / area; // N/mm² = MPa
      const strain = stress / (modulus * 1000);
      return { summary: { stress, strain, displacement: strain * length * 1000 } };
    },
  },
  mohr: {
    definition: {
      id: 'mohr',
      version: '1.0',
      inputs: {
        sigmaX: number('X normal stress', 'MPa', -5000, 5000),
        sigmaY: number('Y normal stress', 'MPa', -5000, 5000),
        tauXY: number('Shear stress', 'MPa', -5000, 5000),
      },
      outputs: {
        summary: {
          center: 'MPa',
          radius: 'MPa',
          principalMax: 'MPa',
          principalMin: 'MPa',
          principalAngle: 'deg',
        },
        series: {},
      },
    },
    /** @param {{sigmaX:number,sigmaY:number,tauXY:number}} input */
    solve({ sigmaX, sigmaY, tauXY }) {
      const center = (sigmaX + sigmaY) / 2;
      const halfDifference = (sigmaX - sigmaY) / 2;
      const radius = Math.hypot(halfDifference, tauXY);
      return {
        summary: {
          center,
          radius,
          principalMax: center + radius,
          principalMin: center - radius,
          principalAngle: radius === 0 ? null : (Math.atan2(tauXY, halfDifference) * 90) / Math.PI,
        },
      };
    },
  },
};
