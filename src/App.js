
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	// items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc3/doc/">App SDK 2.0rc3 Docs</a>'},

    config: {
        defaultSettings: {
            months : "6",
            wsapiProjects : false
        }
    },

	launch: function() {

		var that = this;

        that.rallyFunctions = Ext.create("RallyFunctions",{ 
            ctx : that.getContext(),
        	keys : ['projects']
        });


		that.months = that.createMonthRanges();

		if ( that.getSetting("wsapiProjects")==true) {
			that.readSubProjects(function(list){
				that.subProjects = list;
	            that.createChart();	
	        });
		} else {
			that.createChart();	
		}
		
	},

	readSubProjects : function(callback) {
		var that = this;

        that.rallyFunctions._loadAStoreWithAPromise(
        	"Project",
        	["ObjectID","Parent","Name","Children"],
        	[ { property:"ObjectID", operator:"=", value:that.getContext().getProject().ObjectID } ]
    	).then({
            scope: that,
            success: function(projects) {
            
            	console.log("Current Project:",projects);
				that.rallyFunctions.recurseObject(_.first(projects))
					.then({

						success : function(list) {
							console.log("success",list);
							callback(list);
						},
						failure : function(err) {
							console.log("error",err);
						}
				})
            }
        });
	},

	createMonthRanges : function() {
		var that = this;
		var date = new Date();
		var mArray = [];
		console.log("months",that.getSetting("months"));

		for(x=0; x < parseInt(that.getSetting("months")); x++) {
			var firstDay = new Date(date.getFullYear(), date.getMonth()-x, 1);
			var lastDay = new Date(date.getFullYear(), (date.getMonth()-x) + 1, 0);
			mArray.push({
				label : firstDay.getFullYear() + "-" + 
					firstDay.toLocaleString("en-us", { month: "long" }),
				first : firstDay.toISOString().substring(0,10),
				last : lastDay.toISOString().substring(0,10)
			})
		}
		mArray.reverse();
		console.log("months",mArray);
		return mArray;
	},

	createChart: function (projects) {

		var that = this;

		var configs = _.map(that.months,function(m) {
            var find = {
                "$and" : [{"_ValidFrom": {"$gte" : m.first}}, {"_ValidFrom":{"$lte" : m.last }}]
            }

            if (that.getSetting("wsapiProjects")==false) {
                find['_ProjectHierarchy'] = that.getContext().getProject().ObjectID
            } else {
                find['Project'] = { "$in" :
                    _.map( that.subProjects,function( p ) { 
                        return p.get("ObjectID")})
                }
            }

            console.log("find",find);

			return  {
				find : find,
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
			useHttpPost : true,
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
        },{
            name: 'wsapiProjects',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: 'True to read projects using wsapi',
            margin: '0 0 15 50',
            labelStyle : "width:200px;",
            afterLabelTpl: 'otherwise will use the lbapi project scoping'
        }];
    }

});
