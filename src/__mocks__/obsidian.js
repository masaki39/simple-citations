module.exports = {
	normalizePath: (path) => path,
	App: class {},
	TFile: class {},
	Platform: {
		isWin: process.platform === 'win32',
		isMacOS: process.platform === 'darwin',
		isLinux: process.platform === 'linux',
		isDesktop: true,
		isMobile: false,
	},
	setIcon: () => {},
};
