
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	// items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc3/doc/">App SDK 2.0rc3 Docs</a>'},
	launch: function() {

		var that = this;

		that.createChart();

	},

	createChart: function (projects) {

		var that = this;

		var configs = [ 
			{
				find : {
					'Project' : { "$in" : [that.getContext().getProject().ObjectID] }
				},
				fetch: ['_ValidFrom','_TypeHierarchy'],
				hydrate: ['_TypeHierarchy']
			}
		];

		async.map( configs, that.snapshotQuery, function(err,results) {
			console.log(results);
			// group the snapshots by year/month
			var g = _.groupBy( results[0], function(s) {
				var dt = Rally.util.DateTime.fromIsoString(s.get("_ValidFrom"));
				var year = dt.getFullYear();
				var month = dt.getMonth() + 1;
				return "" + month + "-" + year ;
			});
			that.add(that.createExtChart(g));
		} );
	},

	createExtChart : function(g) {

		// convert the arrays of data into a json format for jston store 
		var data = _.map(_.keys(g), function(mth) {
			return {
				month : mth,
				count : g[mth].length
			};
		});

		// create the store
		var chartStore = Ext.create('Ext.data.JsonStore', {
			fields: ['month','count'],
			data: data
		});

		var chart = new Ext.chart.Chart({
			width: 600,
			height: 400,
			animate: true,
			store: chartStore,
			// renderTo: Ext.getBody(),
			shadow: true,
			axes: [{
				type: 'Numeric',
				position: 'left',
				fields: ['count'],
				label: {
					renderer: Ext.util.Format.numberRenderer('0,0')
				},
				title: 'Count',
				grid: true,
				minimum: 0
			}, {
				type: 'Category',
				position: 'bottom',
				fields: ['month'],
				title: 'Month'
			}],
			series: [{
				type: 'column',
				axis: 'bottom',
				highlight: true,
				xField: 'month',
				yField: 'count'
			}]
		});

		return chart;

	},

	snapshotQuery : function( config, callback ) {

		Ext.create('Rally.data.lookback.SnapshotStore', {
			find : config.find,
			autoLoad : true,
			limit : 'Infinity',
			fetch : config.fetch,
			hydrate : config.hydrate,
			pageSize:1000,

			listeners : {
				scope : this,
				load: function(store, snapshots, success) {
					console.log("Loaded:"+snapshots.length," Snapshots.");
					callback(null,snapshots);
				}
			}
		});
		
	}
		
});
