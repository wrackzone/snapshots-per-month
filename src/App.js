
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	// items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc3/doc/">App SDK 2.0rc3 Docs</a>'},

    config: {
        defaultSettings: {
            months : "6"
        }
    },

	launch: function() {

		var that = this;
		that.months = [];

		var date = new Date();

		console.log("months",that.getSetting("months"));

		for(x=0; x < parseInt(that.getSetting("months")); x++) {
			var firstDay = new Date(date.getFullYear(), date.getMonth()-x, 1);
			var lastDay = new Date(date.getFullYear(), (date.getMonth()-x) + 1, 0);
			that.months.push({
				label : firstDay.getFullYear() + "-" + 
					firstDay.toLocaleString("en-us", { month: "long" }),
				first : firstDay.toISOString().substring(0,10),
				last : lastDay.toISOString().substring(0,10)
			})
		}
		that.months.reverse();
		console.log("months",that.months);

		that.createChart();

	},

	createChart: function (projects) {

		var that = this;

		var configs = _.map(that.months,function(m) {
			return  {
				find : {
					'_ProjectHierarchy' : that.getContext().getProject().ObjectID,
					// '_ProjectHierarchy' : { "$in" : [that.getContext().getProject().ObjectID] },
					"$and" : [{"_ValidFrom": {"$gte" : m.first}}, {"_ValidFrom":{"$lte" : m.last }}]
				},
				fetch: ['_ValidFrom','_TypeHierarchy'],
				hydrate: ['_TypeHierarchy']
			}
		});

		async.map( configs, that.snapshotQuery, function(err,results) {
			console.log(results);
			that.add(that.createExtChart(results));
		} );
	},

	createExtChart : function(results) {
		var that = this;

		// convert the arrays of data into a json format for jston store 
		var data = _.map(results, function(data,i) {
			return {
				month : that.months[i].label,
				count : (data)
			};
		});

		// create the store
		var chartStore = Ext.create('Ext.data.JsonStore', {
			fields: ['month','count'],
			data: data
		});

		var chart = new Ext.chart.Chart({
			width: that.getWidth(),
			height: that.getHeight(),
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
				title: 'Month',
				label : {
					rotate: {
	     				degrees: 45
	    			}
	    		},
			}],
			series: [{
				type: 'column',
				axis: 'bottom',
				highlight: true,
				xField: 'month',
				yField: 'count',
				label : {
					field : 'count',
					display : 'rotate'

				}
				// tooltip: {
    //                 // trackMouse: true,
    //                 renderer: function(tip, item) {
    //                     tip.setTitle(item.get('month'));
    //                     tip.update('Count: ' + item.get('count'));
    //                 }
    //             }
			}]
		});

		return chart;

	},

	snapshotQuery : function( config, callback ) {

		Ext.create('Rally.data.lookback.SnapshotStore', {
			find : config.find,
			autoLoad : true,
			limit : 10,
			fetch : config.fetch,
			hydrate : config.hydrate,
			pageSize: 10,

			listeners : {
				scope : this,
				load: function(store, snapshots, success) {
					console.log("Loaded:"+snapshots.length," Snapshots.");
					console.log("Store",store);
					// callback(null,snapshots);
					callback(null,store.totalCount);
				}
			}
		});
		
	},

    getSettingsFields: function() {
        var me = this;

		return [ {
            name: 'months',
            xtype: 'rallytextfield',
            boxLabelAlign: 'after',
            fieldLabel: '# Months',
            margin: '0 0 15 50',
            labelStyle : "width:200px;",
            afterLabelTpl: 'The number of months to report on.'
        }];
    }

});
